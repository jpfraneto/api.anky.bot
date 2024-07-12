import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const SQUARE_SIZE = 1080; // Size of the final square GIF
const VIDEO_SIZE = Math.floor(SQUARE_SIZE * 0.8); // 80% of the square size
const MAX_GIF_SIZE = 9.9 * 1024 * 1024; // 9.9MB in bytes

function getVideoDuration(inputPath: string): Promise<number> {
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

    let duration = videoDuration;
    let fps = 10;
    let scale = VIDEO_SIZE;

    const createGif = async () => {
      return new Promise<boolean>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(`-t ${duration}`)
          .outputOptions([
            '-vf', `scale=${scale}:${scale}:force_original_aspect_ratio=decrease,pad=${scale}:${scale}:(ow-iw)/2:(oh-ih)/2:color=pink,fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
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

    const pinkBackground = await sharp({
      create: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        channels: 4,
        background: { r: 255, g: 192, b: 203, alpha: 1 }
      }
    }).png().toBuffer();

    const pfpSize = Math.floor(SQUARE_SIZE * 0.2);
    const pfp = await sharp(await fetch(user.pfp_url).then(res => res.arrayBuffer()))
      .resize(pfpSize, pfpSize, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`<svg><circle cx="${pfpSize/2}" cy="${pfpSize/2}" r="${pfpSize/2}" /></svg>`),
        blend: 'dest-in'
      }])
      .toBuffer();

    const createFramedGif = async () => {
      const tempDir = path.join(process.cwd(), 'temp_frames');
      await fs.mkdir(tempDir, { recursive: true });

      return new Promise<number>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(`-t ${duration}`)
          .outputOptions([
            `-vf fps=${fps},scale=${scale}:${scale}:force_original_aspect_ratio=decrease,pad=${scale}:${scale}:(ow-iw)/2:(oh-ih)/2:color=pink`,
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
                const compositeImage = await sharp(pinkBackground)
                  .composite([
                    {
                      input: await sharp(frame)
                        .resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'contain', background: { r: 255, g: 192, b: 203, alpha: 1 } })
                        .toBuffer(),
                      top: Math.floor((SQUARE_SIZE - VIDEO_SIZE) / 2),
                      left: Math.floor((SQUARE_SIZE - VIDEO_SIZE) / 2),
                    },
                    {
                      input: pfp,
                      top: 20,
                      left: SQUARE_SIZE - pfpSize - 20,
                    },
                    {
                      input: Buffer.from(`
                        <svg width="${SQUARE_SIZE}" height="${SQUARE_SIZE}">
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