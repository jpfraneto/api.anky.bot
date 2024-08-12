import { Logger } from '../utils/Logger';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const gifPath = path.join(__dirname, 'gif-base.gif');
const staticImageUrl = 'https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_gif,w_112,h_112/https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/11e5479f-e479-4ba0-2221-97a086f65b00/original';

async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), 'gif-processing-' + crypto.randomBytes(4).toString('hex'));
  await fs.mkdir(tempDir, { recursive: true });
  console.log('Temp directory created:', tempDir);
  return tempDir;
}

async function downloadImage(url, outputPath) {
  console.log('Downloading image from:', url);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  await fs.writeFile(outputPath, response.data);
  console.log('Image downloaded and saved to:', outputPath);
}

async function extractFrames(inputGif, outputDir) {
  console.log('Extracting frames from:', inputGif);
  await execPromise(`ffmpeg -i "${inputGif}" "${path.join(outputDir, 'frame%03d.png')}"`);
  console.log('Frames extracted to:', outputDir);
}

async function processFrame(framePath, staticImagePath, outputPath) {
  console.log('Processing frame:', framePath);
  try {
    const frame = sharp(await fs.readFile(framePath));
    const staticImage = sharp(staticImagePath);

    const [frameMetadata, staticImageMetadata] = await Promise.all([
      frame.metadata(),
      staticImage.metadata()
    ]);
    console.log('Frame metadata:', frameMetadata);
    console.log('Static image metadata:', staticImageMetadata);

    // Define TV screen area (you may need to adjust these values)
    const screenWidth = Math.round(frameMetadata.width * 0.8);  // 80% of frame width
    const screenHeight = Math.round(frameMetadata.height * 0.7);  // 70% of frame height
    const screenX = Math.round((frameMetadata.width - screenWidth) / 2);
    const screenY = Math.round((frameMetadata.height - screenHeight) / 3);
    console.log('Screen dimensions:', { screenWidth, screenHeight, screenX, screenY });

    // Resize and position the static image
    const resizedStaticImage = staticImage.resize({
      width: screenWidth,
      height: screenHeight,
      fit: 'cover',
      position: 'center'
    });

    // Create a blank canvas with the frame size
    const canvas = sharp({
      create: {
        width: frameMetadata.width,
        height: frameMetadata.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Add text overlay with rainbow background and gradient text
    const textSvg = `
      <svg width="${frameMetadata.width}" height="${frameMetadata.height}">
        <defs>
          <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
            <stop offset="16.67%" style="stop-color:rgb(255,127,0);stop-opacity:1" />
            <stop offset="33.33%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgb(0,255,0);stop-opacity:1" />
            <stop offset="66.67%" style="stop-color:rgb(0,0,255);stop-opacity:1" />
            <stop offset="83.33%" style="stop-color:rgb(75,0,130);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(143,0,255);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:black;stop-opacity:1" />
            <stop offset="100%" style="stop-color:white;stop-opacity:1" />
          </linearGradient>
        </defs>
        <style>
          .title-bg { fill: url(#rainbow); stroke: white; stroke-width: 2px; }
          .title { 
            fill: url(#textGradient); 
            font-size: 60px; 
            font-weight: 900; 
            font-family: Arial, sans-serif;
          }
        </style>
        <g transform="translate(${screenX}, ${1.2 * screenY })">
          <rect class="title-bg" x="-10" y="-10" width="${screenWidth + 20}" height="100" rx="2" ry="2" />
          <text x="${screenWidth / 2}" y="60" text-anchor="middle" class="title">@jpfraneto is live on vibra!</text>
        </g>
      </svg>`;

    // Composite all layers
    await canvas
      .composite([
        { input: await resizedStaticImage.toBuffer(), top: screenY, left: screenX },
        { input: await frame.toBuffer(), blend: 'over' },
        { input: Buffer.from(textSvg), top: 0, left: 0 }
      ])
      .toFile(outputPath);

    console.log('Frame processed and saved to:', outputPath);
  } catch (error) {
    console.error('Error processing frame:', error);
    throw error;
  }
}

async function combineFrames(inputDir, outputGif, fps) {
  console.log('Combining frames into GIF');
  await execPromise(`ffmpeg -framerate ${fps} -i "${path.join(inputDir, 'processed_frame%03d.png')}" "${outputGif}"`);
  console.log('GIF created:', outputGif);
}

export async function maiiinn() {
  let tempDir;
  try {
    console.log('Starting GIF processing');

    // Check if the GIF file exists
    try {
      await fs.access(gifPath);
      console.log('GIF file found at:', gifPath);
    } catch (error) {
      console.error('GIF file not found at:', gifPath);
      throw new Error(`GIF file not found at ${gifPath}`);
    }

    tempDir = await createTempDir();
    const staticImagePath = path.join(tempDir, 'static_image.png');
    const outputGif = path.join(__dirname, 'output.gif');

    await downloadImage(staticImageUrl, staticImagePath);
    console.log('Static image downloaded');

    await extractFrames(gifPath, tempDir);
    console.log('Frames extracted');

    const frames = await fs.readdir(tempDir);
    console.log('Number of frames:', frames.length);
    for (const frame of frames.filter(file => file.startsWith('frame'))) {
      const inputFrame = path.join(tempDir, frame);
      const outputFrame = path.join(tempDir, `processed_${frame}`);
      await processFrame(inputFrame, staticImagePath, outputFrame);
    }
    console.log('All frames processed');

    await combineFrames(tempDir, outputGif, 10);
    console.log('Frames combined into new GIF');

    console.log('Processing complete. Output saved as:', outputGif);

    return outputGif;
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  } finally {
    if (tempDir) {
      console.log('Cleaning up temporary directory:', tempDir);
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('Temporary directory cleaned up');
    }
  }
}

export async function processAndSaveGif() {
  try {
    console.log('Starting processAndSaveGif');
    const outputPath = await maiiinn();
    console.log('GIF processing completed. Output path:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('Error in processAndSaveGif:', error);
    throw error;
  }
}