import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const SQUARE_SIZE = 1080; // Size of the final square GIF
const VIDEO_SIZE = Math.floor(SQUARE_SIZE * 0.8); // 80% of the square size

export async function createAndSaveLocallyCompressedGifFromVideo(inputPath: string, outputPath: string): Promise<void> {
  try {
    const stats = await fs.stat(inputPath);
    if (stats.size === 0) {
      throw new Error('Input video file is empty');
    }
  } catch (error) {
    console.error('Error checking input file:', error);
    throw error;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions('-t 10') // Limit to first 10 seconds
      .outputOptions([
        '-vf', `scale=${VIDEO_SIZE}:${VIDEO_SIZE}:force_original_aspect_ratio=decrease,pad=${VIDEO_SIZE}:${VIDEO_SIZE}:(ow-iw)/2:(oh-ih)/2,fps=10,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        '-loop', '0'
      ])
      .toFormat('gif')
      .on('start', (commandLine) => {
        console.log('FFmpeg process started:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + progress.percent + '% done');
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error:', err.message);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('FFmpeg process completed');
        resolve();
      })
      .save(outputPath);
  });
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

export async function createFrameGifFromVideoGif(inputGifPath: string, outputGifPath: string, user: { username: string, craft: string, pfp_url: string }) {
  const backgroundPath = path.join(process.cwd(), 'public', 'zurf-background.png');
  const background = await sharp(backgroundPath).resize(SQUARE_SIZE, SQUARE_SIZE).toBuffer();

  const pfpSize = Math.floor(SQUARE_SIZE * 0.2); // 20% of the square size for the profile picture
  const pfp = await sharp(await fetch(user.pfp_url).then(res => res.arrayBuffer()))
    .resize(pfpSize, pfpSize, { fit: 'cover' })
    .composite([{
      input: Buffer.from(`<svg><circle cx="${pfpSize/2}" cy="${pfpSize/2}" r="${pfpSize/2}" /></svg>`),
      blend: 'dest-in'
    }])
    .toBuffer();

  const frames = await getGifFrames(inputGifPath);
  const outputFrames: Buffer[] = [];

  for (let i = 0; i < frames.length; i += 2) { // Process every other frame
    const frame = frames[i];
    const compositeImage = await sharp(background)
      .composite([
        {
          input: await sharp(frame)
            .resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer(),
          top: Math.floor((SQUARE_SIZE - VIDEO_SIZE) / 2),
          left: Math.floor((SQUARE_SIZE - VIDEO_SIZE) / 2),
        },
        {
          input: pfp,
          top: 20,
          left: SQUARE_SIZE - pfpSize - 20, // Top right corner with some padding
        },
        {
          input: Buffer.from(`
            <svg width="${SQUARE_SIZE}" height="${SQUARE_SIZE}">
              <text x="20" y="40" font-family="Arial" font-size="30" font-weight="bold" fill="white">@${user.username}</text>
              <text x="20" y="80" font-family="Arial" font-size="25" font-weight="bold" fill="#00FFFF">${user.craft}</text>
            </svg>
          `),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    outputFrames.push(compositeImage);
  }

  const tempDir = path.join(process.cwd(), 'temp_output_frames');
  await fs.mkdir(tempDir, { recursive: true });

  for (let i = 0; i < outputFrames.length; i++) {
    await fs.writeFile(path.join(tempDir, `frame_${i}.png`), outputFrames[i]);
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(path.join(tempDir, 'frame_%d.png'))
      .inputFPS(5)
      .outputOptions([
        '-vf', 'split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-loop', '0',
        '-final_delay', '500'
      ])
      .output(outputGifPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  await fs.rm(tempDir, { recursive: true, force: true });
}