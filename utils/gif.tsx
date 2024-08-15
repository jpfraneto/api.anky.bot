import { Logger } from './Logger.js';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import prisma from './prismaClient.js';
import { uploadGifToTheCloud } from './cloudinary.js';
import { getUserFromFid, getUserFromUsername } from './farcaster.js';
const GIF_DIRECTORY = path.join(process.cwd(), 'temp_gifs')


const execPromise = util.promisify(exec);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gifPath = path.join(__dirname, 'gif-base.gif');

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

async function processFrame(framePath, staticImagePath, outputPath, streamerName) {
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
        <g transform="translate(${screenX}, ${1.2 * screenY})">
          <rect class="title-bg" x="-10" y="-10" width="${screenWidth + 20}" height="100" rx="2" ry="2" />
          <text x="${screenWidth / 2}" y="60" text-anchor="middle" class="title">@${streamerName} is live on vibra!</text>
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
  console.log('Combining frames into GIF', inputDir, outputGif,fps);
  await execPromise(`ffmpeg -framerate ${fps} -i "${path.join(inputDir, 'processed_frame%03d.png')}" "${outputGif}"`);
  console.log('GIF created:', outputGif);
}

export async function maiiinn(staticImageUrl, streamerName, outputPath) {
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

    await downloadImage(staticImageUrl, staticImagePath);
    console.log('Static image downloaded');

    await extractFrames(gifPath, tempDir);
    console.log('Frames extracted');

    const frames = await fs.readdir(tempDir);
    console.log('Number of frames:', frames.length);
    for (const frame of frames.filter(file => file.startsWith('frame'))) {
      const inputFrame = path.join(tempDir, frame);
      const outputFrame = path.join(tempDir, `processed_${frame}`);
      await processFrame(inputFrame, staticImagePath, outputFrame, streamerName);
    }
    console.log('All frames processed');

    await combineFrames(tempDir, outputPath, 10);
    console.log('Frames combined into new GIF');

    console.log('Processing complete. Output saved as:', outputPath);

    return outputPath;
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

export async function processAndSaveGif(staticImageUrl, streamerName, outputPath) {
  try {
    console.log('Starting processAndSaveGif');
    const finalOutputPath = await maiiinn(staticImageUrl, streamerName, outputPath);
    console.log('GIF processing completed. Output path:', finalOutputPath);
    return finalOutputPath;
  } catch (error) {
    console.error('Error in processAndSaveGif:', error);
    throw error;
  }
}

export async function createUserFromFidAndUploadGif(fid: string): Promise<string | null> {
  try {
    console.log("Creating user and generating/uploading GIF for user with FID:", fid);

    // Fetch user data from Farcaster
    const userData = await getUserFromFid(Number(fid));
    console.log("IN HERE, THE USER DATA IS: ", userData)
    if (!userData) {
      console.error("User not found on Farcaster:", fid);
      return null;
    }

    // Create or update user in the database
    const user = await prisma.user.upsert({
      where: { fid: fid },
      update: {
        username: userData.username,
        displayName: userData.displayName,
        pfpUrl: userData.pfpUrl
      },
      create: {
        fid: fid,
        username: userData.username,
        displayName: userData.display_name,
        pfpUrl: userData.pfp_url
      }
    });

    // Generate and save the GIF locally
    const gifPath = path.join(GIF_DIRECTORY, `${fid}.gif`);
    await fs.mkdir(GIF_DIRECTORY, { recursive: true });
    await processAndSaveGif(userData.pfp_url, userData.username, gifPath);

    // Upload the GIF to Cloudinary
    const cloudinaryResponse = await uploadGifToTheCloud(
      gifPath,
      `user_gif_${fid}`,
      'user_gifs'
    );

    // Update user with Cloudinary GIF URL
    await prisma.user.update({
      where: { id: user.id },
      data: { gifUrl: cloudinaryResponse.secure_url }
    });

    // Clean up the local GIF file
    await fs.unlink(gifPath);

    console.log("User created/updated and GIF uploaded for FID:", fid);
    return cloudinaryResponse.secure_url;
  } catch (error) {
    console.error("Error in createUserAndUploadGif:", error);
    return null;
  }
}

export async function createUserAndUploadGif(streamer: string): Promise<string | null> {
  try {
    console.log("Creating user and generating/uploading GIF for streamer:", streamer);

    // Fetch user data from Farcaster
    const userData = await getUserFromUsername(streamer);
    if (!userData) {
      console.error("User not found on Farcaster:", streamer);
      return null;
    }

    // Create or update user in the database
    const user = await prisma.user.upsert({
      where: { fid: userData.fid.toString() },
      update: {
        username: userData.username,
        displayName: userData.displayName,
        pfpUrl: userData.pfp.url
      },
      create: {
        fid: userData.fid.toString(),
        username: userData.username,
        displayName: userData.displayName,
        pfpUrl: userData.pfp.url
      }
    });

    // Generate and save the GIF locally
    const gifPath = path.join(GIF_DIRECTORY, `${streamer}.gif`);
    await fs.mkdir(GIF_DIRECTORY, { recursive: true });
    await processAndSaveGif(userData.pfp.url, streamer, gifPath);

    // Upload the GIF to Cloudinary
    const cloudinaryResponse = await uploadGifToTheCloud(
      gifPath,
      `user_gif_${streamer}`,
      'user_gifs'
    );

    // Update user with Cloudinary GIF URL
    await prisma.user.update({
      where: { id: user.id },
      data: { gifUrl: cloudinaryResponse.secure_url }
    });

    // Clean up the local GIF file
    await fs.unlink(gifPath);

    console.log("User created/updated and GIF uploaded for:", streamer);
    return cloudinaryResponse.secure_url;
  } catch (error) {
    console.error("Error in createUserAndUploadGif:", error);
    return null;
  }
}