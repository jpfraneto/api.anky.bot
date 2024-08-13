import { PrismaClient } from '@prisma/client'
import { uploadGifToTheCloud } from '../../../utils/cloudinary'
import { Button, FrameContext, Frog, TextInput } from 'frog';
import { SECRET } from '../../../env/server-env';
import { NEYNAR_API_KEY, VIBRA_LIVESTREAMS_API, VIBRA_LIVESTREAMS_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { fileURLToPath } from 'url';
import queryString from 'query-string';


const execAsync = promisify(exec);

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GIF_DIRECTORY = path.join(__dirname, 'generated_gifs');

import prisma from '../../../utils/prismaClient';

async function createClipAndStoreLocally(playbackId: string, streamId: string) {
    console.log(`Starting clip creation process for stream ID: ${streamId}`);
    try {
      const endTime = Date.now();
      const startTime = endTime - 30000; // 30 seconds before
      console.log(`Clip time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      const streamResult = await livepeer.stream.get(streamId);
      console.log('Stream result:', streamResult);
      console.log('Calling Livepeer API to create clip...', endTime, startTime);
      const clipResult = await livepeer.stream.createClip({
        playbackId,
        startTime,
        endTime: startTime + 30000, // 30 seconds
        name: `Clip_${endTime}`,
      });
      console.log("The clip was created clip", clipResult)
      const clipData = clipResult.data
      console.log(`Clip created. Clip asset ID: ${clipData?.asset.id}`);
  
      console.log('Waiting for asset to be ready...');
      const asset = await waitForAssetReady(clipData?.asset.id!);
      console.log('Asset is ready for download.');
  
      console.log(`Downloading clip from URL: ${asset.downloadUrl}`);
      const videoPath = await downloadClip(asset.downloadUrl);
      console.log(`Clip downloaded and saved to: ${videoPath}`);
  
      console.log('Creating GIF from the downloaded clip...');
      const gifPath = await createGifFromVideo(videoPath);
      console.log(`GIF created and saved to: ${gifPath}`);

      // Get the current clip count for this stream
      const clipCount = await prisma.clip.count({
        where: { streamId: streamId }
      });
      const clipIndex = clipCount + 1;

      // Upload GIF to Cloudinary
      console.log('Uploading GIF to Cloudinary...');
      const cloudinaryResponse = await uploadGifToTheCloud(
        gifPath,
        `${streamId}_${clipIndex}`,
        `clip_gifs/${streamId}`
      );
      console.log('GIF uploaded to Cloudinary:', cloudinaryResponse.secure_url);

      // Create or update the clip record in the database
      const clip = await prisma.clip.create({
        data: {
          stream: { connect: { id: streamId } },
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          assetId: clipData?.asset.id,
          downloadUrl: asset.downloadUrl,
          gifUrl: gifPath,
          cloudinaryUrl: cloudinaryResponse.secure_url,
          clipIndex: clipIndex,
          status: 'READY'
        }
      });
      console.log('Clip record created in database:', clip);

      console.log(`Cleaning up temporary video file: ${videoPath}`);
      await fs.unlink(videoPath);
      console.log('Temporary video file deleted.');
  
      console.log(`GIF creation process completed for clip from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    } catch (error) {
      console.error("Error in createClipAndStoreLocally:", error);
    }
  }

  async function waitForAssetReady(assetId: string): Promise<any> {
    console.log(`Waiting for asset ${assetId} to be ready...`);
    let attempts = 0;
    while (true) {
      attempts++;
      console.log(`Checking asset status. Attempt ${attempts}...`);
      const response = await livepeer.asset.get(assetId);
      const asset = response.asset
      console.log("IN HEREEEEEE, the asset is: ", asset)
      if (asset?.status?.phase === "ready") {
        console.log(`Asset ${assetId} is ready after ${attempts} attempts.`);
        return asset;
      }
      console.log(`Asset not ready. Current status: ${asset?.status?.phase}. Waiting 5 seconds before next check.`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
    }
  }
  
  async function downloadClip(url: string): Promise<string> {
    console.log(`Starting download of clip from URL: ${url}`);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
  
    const tempDir = path.join(process.cwd(), 'temp');
    console.log(`Ensuring temporary directory exists: ${tempDir}`);
    await fs.mkdir(tempDir, { recursive: true });
  
    const filePath = path.join(tempDir, `clip_${Date.now()}.mp4`);
    console.log(`Saving downloaded clip to: ${filePath}`);
    await fs.writeFile(filePath, buffer);
  
    console.log(`Clip downloaded and saved successfully.`);
    return filePath;
  }
  
  async function createGifFromVideo(videoPath: string): Promise<string> {
    console.log(`Starting square GIF creation process for video: ${videoPath}`);
    const outputDir = path.join(process.cwd(), 'clip-gifs');
    console.log(`Ensuring output directory exists: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
  
    const outputPath = path.join(outputDir, `square_gif_${Date.now()}.gif`);
    console.log(`Output square GIF will be saved to: ${outputPath}`);
  
    console.log('Executing ffmpeg command to create square GIF...');
    const ffmpegCommand = `
      ffmpeg -i ${videoPath} -vf "
        fps=10,
        scale=iw*min(320/iw\\,320/ih):ih*min(320/iw\\,320/ih),
        pad=320:320:(320-iw*min(320/iw\\,320/ih))/2:(320-ih*min(320/iw\\,320/ih))/2:black,
        setsar=1:1
      " -c:v gif ${outputPath}
    `.replace(/\s+/g, ' ').trim();
    
    console.log(`FFmpeg command: ${ffmpegCommand}`);
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      console.log('FFmpeg stdout:', stdout);
      console.log('FFmpeg stderr:', stderr);
    } catch (error) {
      console.error('Error executing ffmpeg command:', error);
      throw error;
    }
  
    console.log(`Square GIF created successfully: ${outputPath}`);
    return outputPath;
  }

  export async function startClippingProcess(playbackId: string, streamId: string) {
    console.log(`Setting up interval for clipping process. Playback ID: ${playbackId}`);
    setInterval(async () => {
      console.log('Interval triggered. Creating new clip...');
      try {
        await createClipAndStoreLocally(playbackId, streamId);
      } catch (error) {
        console.error("Error in clipping process:", error);
      }
    }, 60000); // Run every 60 seconds
  }

  export async function getLatestClipFromStream(streamer: string) {
    try {
      // First, find the latest stream for this streamer
      const latestStream = await prisma.stream.findFirst({
        where: { user: { username: streamer } },
        orderBy: { startedAt: 'desc' },
        include: { clips: { orderBy: { clipIndex: 'desc' }, take: 1 } }
      });
  
      if (!latestStream) {
        console.log(`No streams found for streamer: ${streamer}`);
        return  {
          hasClips: false,
          streamId: "streamid",
          playbackId: "hello world"
        };
      }
  
      if (latestStream.clips.length === 0) {
        console.log(`No clips found for the latest stream of ${streamer}`);
        return {
          hasClips: false,
          streamId: latestStream.id,
          playbackId: latestStream.playbackId
        };
      }
  
      const latestClip = latestStream.clips[0];
      return {
        hasClips: true,
        gifUrl: latestClip.cloudinaryUrl,
        index: latestClip.clipIndex,
        livepeerStreamId: latestStream.id,
        playbackId: latestStream.playbackId
      };
    } catch (error) {
      console.error("Error in getLatestClipFromStream:", error);
      return null;
    }
  }