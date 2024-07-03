import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

async function getGifFrames(gifPath: string): Promise<Buffer[]> {
  // ... (keep this function as is)
}

export async function createEnhancedGif(inputGifPath: string, outputGifPath: string, user: { username: string, craft: string, pfp_url: string }) {
  const backgroundPath = path.join(process.cwd(), 'public', 'zurf-background.png');
  const background = await sharp(backgroundPath).resize(1080, 1920).toBuffer();

  const pfp = await sharp(await fetch(user.pfp_url).then(res => res.arrayBuffer()))
    .resize(200, 200, { fit: 'cover' })
    .composite([{
      input: Buffer.from(`<svg><circle cx="100" cy="100" r="100" /></svg>`),
      blend: 'dest-in'
    }])
    .toBuffer();

  const frames = await getGifFrames(inputGifPath);
  const outputFrames: Buffer[] = [];

  for (const frame of frames) {
    const compositeImage = await sharp(background)
      .composite([
        {
          input: pfp,
          top: 50,
          left: 50,
        },
        {
          input: await sharp(frame).resize(480, 854, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
          top: 50,
          left: 550,
        },
        {
          input: Buffer.from(`
            <svg width="1080" height="1920">
              <text x="270" y="120" font-family="Arial" font-size="40" font-weight="bold" fill="white">@${user.username}</text>
              <text x="270" y="170" font-family="Arial" font-size="30" fill="#00FFFF">${user.craft}</text>
              <text x="50" y="1870" font-family="Arial" font-size="40" font-weight="bold" fill="white">ZURF</text>
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
        '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
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