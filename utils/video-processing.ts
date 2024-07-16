import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const FINAL_GIF_SIZE = 350; // Final size of the GIF
const VIDEO_SIZE = Math.floor(FINAL_GIF_SIZE * 0.8); // 80% of the final GIF size
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

    let duration = Math.min(videoDuration, 30);
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