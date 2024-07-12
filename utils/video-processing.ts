import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const SQUARE_SIZE = 1080; // Size of the final square GIF
const VIDEO_SIZE = Math.floor(SQUARE_SIZE * 0.8); // 80% of the square size
const MAX_GIF_SIZE = 9.9 * 1024 * 1024; // 9.9MB in bytes

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
    let duration = 10; // Start with 10 seconds
    const createGif = () => {
      ffmpeg(inputPath)
        .inputOptions(`-t ${duration}`)
        .outputOptions([
          '-vf', `scale=${VIDEO_SIZE}:${VIDEO_SIZE}:force_original_aspect_ratio=increase,crop=${VIDEO_SIZE}:${VIDEO_SIZE},fps=10,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          '-loop', '0'
        ])
        .toFormat('gif')
        .on('end', async () => {
          const gifStats = await fs.stat(outputPath);
          if (gifStats.size > MAX_GIF_SIZE && duration > 1) {
            duration -= 1;
            console.log(`GIF too large (${gifStats.size} bytes), reducing duration to ${duration} seconds`);
            createGif();
          } else {
            console.log('GIF creation completed');
            resolve();
          }
        })
        .on('error', (err) => {
          console.error('Error:', err.message);
          reject(err);
        })
        .save(outputPath);
    };
    
    createGif();
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

  const frames = await getGifFrames(inputGifPath);
  const outputFrames: Buffer[] = [];

  for (const frame of frames) {
    const compositeImage = await sharp(pinkBackground)
      .composite([
        {
          input: await sharp(frame)
            .resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'cover' })
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
              <text x="20" y="40" font-family="Arial" font-size="88" font-weight="bold" fill="black">@${user.username}</text>
              <text x="20" y="100" font-family="Arial" font-size="25" font-weight="bold" fill="yellow">${user.craft}</text>
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
      .inputFPS(10)
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