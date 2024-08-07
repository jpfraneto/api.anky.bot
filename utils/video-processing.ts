import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { Cast } from './types/cast';
import { v4 as uuidv4 } from 'uuid';
import { uploadGifToTheCloud } from './cloudinary';
import prisma from './prismaClient';
import { DUMMY_BOT_SIGNER, NEYNAR_DUMMY_BOT_API_KEY, REDIS_URL, CHISPITA_OXIDA_SIGNER_UUID } from '../env/server-env';
import { fetchCastInformationFromHash, publishCastToTheProtocol } from './cast';
import Queue from 'bull';
import { Redis } from 'ioredis';
import { CastIntention } from './types/cast';

// Create a Redis client
const redis = new Redis(REDIS_URL);

// Create a Bull queue
const videoProcessingQueue = new Queue('video-processing', REDIS_URL);

interface VideoProcessingJob {
  castHash: string;
  addedByFid: number;
}

export const failedCastsQueue = new Queue('failed-casts', REDIS_URL);

interface FailedCastJob {
  castOptions: CastIntention;
  error: string;
  attempts: number;
}

export async function queueFailedCast(castOptions: CastIntention, error: string) {
  const job = await failedCastsQueue.add({
    castOptions,
    error,
    attempts: 0,
  });

  return job.id;
}

// Process jobs from the failed casts queue
failedCastsQueue.process(async (job) => {
  const { castOptions, attempts } = job.data as FailedCastJob;

  if (attempts >= 3) {
    // If we've tried 3 times, give up and log the error
    console.error(`Failed to publish cast after 3 attempts:`, castOptions);
    return;
  }

  try {
    const result = await publishCastToTheProtocol(castOptions);
    // If successful, remove the job from the queue
    await job.remove();
    return result;
  } catch (error) {
    // If it fails again, increment the attempts and retry later
    await job.update({
      ...job.data,
      attempts: attempts + 1,
      error: error.message,
    });
    throw error;
  }
});


export async function queueCastVideoProcessing(cast: Cast, addedByFid: number) {
  const job = await videoProcessingQueue.add({
    castHash: cast.hash,
    addedByFid,
  });

  // Update the database to reflect that processing has started
  await prisma.castWithVideo.upsert({
    where: { castHash: cast.hash },
    update: { status: 'PROCESSING' },
    create: {
      castHash: cast.hash,
      status: 'PROCESSING',
      addedByFid,
    },
  });

  return job.id;
}

// Process jobs from the queue
videoProcessingQueue.process(async (job) => {
  const { castHash, addedByFid } = job.data as VideoProcessingJob;

  try {
    const cast = await fetchCastInformationFromHash(castHash);
    const gifUrl = await processVideoJob(cast, addedByFid);

    // Update the database with the result
    await prisma.castWithVideo.update({
      where: { castHash },
      data: {
        status: 'COMPLETED',
        gifUrl,
      },
    });

    return gifUrl;
  } catch (error) {
    console.error(`Error processing video for cast ${castHash}:`, error);

    // Update the database to reflect the error
    await prisma.castWithVideo.update({
      where: { castHash },
      data: {
        status: 'ERROR',
        errorMessage: error.message,
      },
    });

    throw error;
  }
});

// Function to check the status of a video processing job
export async function checkVideoProcessingStatus(castHash: string) {
  const castWithVideo = await prisma.castWithVideo.findUnique({
    where: { castHash },
  });

  return castWithVideo?.status || 'NOT_FOUND';
}

const FINAL_GIF_SIZE = 350; // Final size of the GIF
const VIDEO_SIZE = Math.floor(FINAL_GIF_SIZE * 0.8); // 80% of the final GIF size
const MAX_GIF_SIZE = 9.9 * 1024 * 1024; // 9.9MB in bytes

export function isHLSStream(url: string): boolean {
  return url.toLowerCase().endsWith('.m3u8');
}

export function downloadHLSStream(inputUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputUrl)
      .outputOptions('-c copy') // Copy without re-encoding
      .outputOptions('-bsf:a aac_adtstoasc') // Fix for some HLS streams
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

export async function createAndSaveLocallyCompressedGifFromVideo(inputPath: string, outputPath: string): Promise<void> {
  try {
    const stats = await fs.stat(inputPath);
    if (stats.size === 0) {
      throw new Error('Input video file is empty');
    }

    const videoDuration = await getVideoDuration(inputPath);
    console.log(`Video duration: ${videoDuration} seconds`);

    let duration = Math.min(videoDuration, 30);
    let fps = 10;
    let scale = VIDEO_SIZE;

    const createGif = async () => {
      return new Promise<boolean>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(`-t ${duration}`)
          .outputOptions([
            '-vf', `scale=${scale}:${scale}:force_original_aspect_ratio=decrease,pad=${scale}:${scale}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
            '-loop', '0'
          ])
          .toFormat('gif')
          .on('start', (commandLine) => {
            console.log('FFmpeg process started:', commandLine);
          })
          .on('progress', (progress) => {
            console.log('Processing: ' + progress.percent + '% done');
          })
          .on('end', async () => {
            const gifStats = await fs.stat(outputPath);
            console.log(`Generated GIF size: ${gifStats.size} bytes`);
            resolve(gifStats.size <= MAX_GIF_SIZE);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg error:', err.message);
            console.error('FFmpeg stdout:', stdout);
            console.error('FFmpeg stderr:', stderr);
            reject(err);
          })
          .save(outputPath);
      });
    };

    let isWithinSizeLimit = await createGif();

    while (!isWithinSizeLimit && duration > 1) {
      duration = Math.max(duration * 0.9, 1);
      fps = Math.max(fps * 0.9, 5);
      scale = Math.max(Math.floor(scale * 0.9), 160);
      console.log(`GIF too large, adjusting parameters: duration=${duration.toFixed(2)}s, fps=${fps.toFixed(2)}, scale=${scale}`);
      isWithinSizeLimit = await createGif();
    }

    if (!isWithinSizeLimit) {
      throw new Error('Unable to create GIF within size limit');
    }

    console.log('GIF creation completed successfully');
  } catch (error) {
    console.error('Error in createAndSaveLocallyCompressedGifFromVideo:', error);
    throw error;
  }
}

async function getGifFrames(gifPath: string): Promise<Buffer[]> {
  const tempDir = path.join(process.cwd(), 'temp_frames');
  await fs.mkdir(tempDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    ffmpeg(gifPath)
      .outputOptions('-vsync', '0')
      .output(path.join(tempDir, 'frame%d.png'))
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  const files = await fs.readdir(tempDir);
  if (files) {
    const framePaths = files
      .filter(file => file.startsWith('frame') && file.endsWith('.png'))
      .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));

    const frames = await Promise.all(framePaths.map(file => fs.readFile(path.join(tempDir, file))));

    await fs.rm(tempDir, { recursive: true, force: true });

    return frames;
  }
  return [];
}

export function isValidVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', 'm3u8'];
  const lowercaseUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowercaseUrl.endsWith(ext));
}

function getVideoDimensions(inputPath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else {
        const { width, height } = metadata.streams.find(stream => stream.codec_type === 'video') || {};
        if (width && height) {
          resolve({ width, height });
        } else {
          reject(new Error('Unable to determine video dimensions'));
        }
      }
    });
  });
}

export async function createFramedGifFromVideo(
  inputPath: string, 
  outputPath: string, 
  user: { username: string; pfp_url: string }
): Promise<void> {
  try {
    const stats = await fs.stat(inputPath);
    if (stats.size === 0) {
      throw new Error('Input video file is empty');
    }

    const videoDuration = await getVideoDuration(inputPath);
    console.log(`Video duration: ${videoDuration} seconds`);

    let duration = videoDuration;
    let fps = 10;
    let scale = VIDEO_SIZE;

    const blackBackground = await sharp({
      create: {
        width: FINAL_GIF_SIZE,
        height: FINAL_GIF_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();


    const createFramedGif = async () => {
      const tempDir = path.join(process.cwd(), 'temp_frames');
      await fs.mkdir(tempDir, { recursive: true });

      return new Promise<number>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(`-t ${duration}`)
          .outputOptions([
            `-vf fps=${fps},scale=${scale}:${scale}:force_original_aspect_ratio=decrease,pad=${scale}:${scale}:(ow-iw)/2:(oh-ih)/2:color=black`,
            '-vsync', '0'
          ])
          .output(path.join(tempDir, 'frame%d.png'))
          .on('end', async () => {
            try {
              const files = await fs.readdir(tempDir);
              const framePaths = files
                .filter(file => file.startsWith('frame') && file.endsWith('.png'))
                .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));

              const outputFrames: Buffer[] = [];

              for (const framePath of framePaths) {
                const frame = await fs.readFile(path.join(tempDir, framePath));
                const compositeImage = await sharp(blackBackground)
                  .composite([
                    {
                      input: await sharp(frame)
                        .resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
                        .toBuffer(),
                      top: Math.floor((FINAL_GIF_SIZE - VIDEO_SIZE) / 2),
                      left: Math.floor((FINAL_GIF_SIZE - VIDEO_SIZE) / 2),
                    },
                    {
                      input: Buffer.from(`
                        <svg width="${FINAL_GIF_SIZE}" height="${FINAL_GIF_SIZE}">
                          <text x="20" y="100" font-family="Arial" font-size="88" font-weight="bold" fill="black">@${user.username}</text>
                        </svg>
                      `),
                      top: 0,
                      left: 0,
                    },
                  ])
                  .toBuffer();

                outputFrames.push(compositeImage);
              }

              await fs.rm(tempDir, { recursive: true, force: true });

              const outputTempDir = path.join(process.cwd(), 'temp_output_frames');
              await fs.mkdir(outputTempDir, { recursive: true });

              for (let i = 0; i < outputFrames.length; i++) {
                await fs.writeFile(path.join(outputTempDir, `frame_${i}.png`), outputFrames[i]);
              }

              await new Promise<void>((resolveFFmpeg, rejectFFmpeg) => {
                ffmpeg()
                  .input(path.join(outputTempDir, 'frame_%d.png'))
                  .inputFPS(fps)
                  .outputOptions([
                    '-vf', 'split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
                    '-loop', '0'
                  ])
                  .output(outputPath)
                  .on('end', resolveFFmpeg)
                  .on('error', rejectFFmpeg)
                  .run();
              });

              await fs.rm(outputTempDir, { recursive: true, force: true });

              const gifStats = await fs.stat(outputPath);
              console.log(`Generated framed GIF size: ${gifStats.size} bytes`);
              resolve(gifStats.size);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject)
          .run();
      });
    };

    let gifSize = await createFramedGif();

    while (gifSize > MAX_GIF_SIZE && duration > 1) {
      duration = Math.max(duration * 0.9, 1);
      fps = Math.max(fps * 0.9, 5);
      scale = Math.max(Math.floor(scale * 0.9), 160);
      console.log(`GIF too large, adjusting parameters: duration=${duration.toFixed(2)}s, fps=${fps.toFixed(2)}, scale=${scale}`);
      gifSize = await createFramedGif();
    }

    if (gifSize > MAX_GIF_SIZE) {
      throw new Error('Unable to create framed GIF within size limit');
    }

    console.log('Framed GIF creation completed successfully');
  } catch (error) {
    console.error('Error in createFramedGifFromVideo:', error);
    throw error;
  }
}

export async function processVideoJob (cast: Cast, addedByFid: number) {
  try {
    const videoUrl = cast.embeds[0]?.url;

    if (!isValidVideoUrl(videoUrl)) {
      throw new Error('No valid video URL found in the cast');
    }
  
    // Generate unique identifiers for our files
    const uuid = uuidv4();
    const videoPath = path.join(process.cwd(), 'temp', `${uuid}.mp4`);
    await fs.mkdir(path.dirname(videoPath), { recursive: true });
  
    // Download the video
    if (isHLSStream(videoUrl)) {
      await downloadHLSStream(videoUrl, videoPath);
    } else {
      const videoResponse = await fetch(videoUrl);
      const videoArrayBuffer = await videoResponse.arrayBuffer();
      const videoBuffer = Buffer.from(videoArrayBuffer);
      await fs.writeFile(videoPath, videoBuffer);
    }
  
    // Process the video and create a GIF
    const gifPath = path.join(process.cwd(), 'temp', `${uuid}.gif`);
    const videoDuration = await getVideoDuration(videoPath);
    let gifDuration = Math.min(videoDuration, 30); // Cap at 30 seconds
    let fps = 10;
    let scale = 350;
    let gifSize = Infinity;
  
    while (gifSize > 10 * 1024 * 1024 && gifDuration > 1) { // 10MB limit
      await createAndSaveLocallyCompressedGifFromVideo(videoPath, gifPath);
      const stats = await fs.stat(gifPath);
      gifSize = stats.size;
  
      if (gifSize > 10 * 1024 * 1024) {
        gifDuration = Math.max(gifDuration * 0.9, 1);
        fps = Math.max(fps * 0.9, 5);
        scale = Math.max(Math.floor(scale * 0.9), 160);
      }
    }
  
    if (gifSize > 10 * 1024 * 1024) {
      throw new Error('Unable to create GIF within size limit');
    }
  
    // Upload the GIF to Cloudinary
    const cloudinaryResult = await uploadGifToTheCloud(gifPath, `cast_gifs/${uuid}`);
  
    // Upsert to database
    const castWithVideo = await prisma.castWithVideo.upsert({
      where: { castHash: cast.hash },
      update: {
        gifUrl: cloudinaryResult.secure_url,
        videoDuration,
        uuid,
        gifDuration,
        fps,
        scale,
      },
      create: {
        castHash: cast.hash,
        gifUrl: cloudinaryResult.secure_url,
        uuid,
        videoDuration,
        gifDuration,
        fps,
        scale,
      },
    });
  
    // Publish a cast with the GIF
    const castOptions = {
      text: `this video is now available on /vibra\n\nand here it is as a gift\n\nsorry, as a gif\n\nyou can turn these replies off on the frame\n\nbut any video you share on warpcast will still be available on /vibra (because it is a farcaster client)`,
      embeds: [{url: `https://frames.vibra.so/vibra/cast-gifs/${uuid}/${cast.hash}`}],
      parent: cast.hash,
      signer_uuid: CHISPITA_OXIDA_SIGNER_UUID,
    };
  
    await publishCastToTheProtocol(castOptions, CHISPITA_OXIDA_SIGNER_UUID );
  
    // Clean up temporary files
    await fs.unlink(videoPath);
    await fs.unlink(gifPath);
  
    return castWithVideo.gifUrl;
  } catch (error) {
    console.log("there was an error hereeee")
  }
}