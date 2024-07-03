import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export async function processVideo(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions('-t 5') // Take the first 5 seconds of the video
        .outputOptions('-vf', 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:-1:-1,setsar=1') // Set to 854x480 (16:9 aspect ratio)
        .toFormat('gif')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
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
  const framePaths = files
    .filter(file => file.startsWith('frame') && file.endsWith('.png'))
    .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));

  const frames = await Promise.all(framePaths.map(file => fs.readFile(path.join(tempDir, file))));

  await fs.rm(tempDir, { recursive: true, force: true });

  return frames;
}

export async function createEnhancedGif(inputGifPath: string, outputGifPath: string, user: { username: string, craft: string, pfp_url: string }) {
    const backgroundPath = path.join(process.cwd(), 'public', 'zurf-background.png');
    const background = await sharp(backgroundPath).resize(1920, 1080).toBuffer();
  
    const pfp = await sharp(await fetch(user.pfp_url).then(res => res.arrayBuffer()))
      .resize(150, 150, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`<svg><circle cx="75" cy="75" r="75" /></svg>`),
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
            input: pfp,
            top: 50,
            left: 50,
          },
          {
            input: await sharp(frame).resize(854, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
            top: 50,
            left: 1000,
          },
          {
            input: Buffer.from(`
              <svg width="1920" height="1080">
                <text x="220" y="100" font-family="Arial" font-size="40" font-weight="bold" fill="white">@${user.username}</text>
                <text x="220" y="150" font-family="Arial" font-size="30" fill="#00FFFF">${user.craft}</text>
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
          '-vf', 'scale=960:540,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
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