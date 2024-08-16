import { uploadGifToTheCloud } from '../../../utils/cloudinary'
import { clipQueue } from '../../../utils/queue/queueConfig';
import {  LIVEPEER_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Job } from 'bullmq';
import { processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { fileURLToPath } from 'url';
import queryString from 'query-string';

import prisma from '../../../utils/prismaClient';
import { sleep } from '../../../utils/time';


const execAsync = promisify(exec);

const livepeer = new Livepeer({
  apiKey: LIVEPEER_API_KEY,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GIF_DIRECTORY = path.join(__dirname, 'generated_gifs');


// async function createClipAndStoreLocally(playbackId: string, streamId: string) {
//   console.log(`Starting clip creation process for stream ID: ${streamId}`);
//   try {
//     const startTime = Date.now();
//     const endTime = startTime + 30000;
//     console.log(`Clip time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

//     // Get the current clip count for this stream
//     const clipCount = await prisma.clip.count({
//       where: { streamId: streamId }
//     });
//     const clipIndex = clipCount + 1;

//     // Create clip request to Livepeer
//     console.log('Calling Livepeer API to create clip...');
//     const clipResult = await livepeer.stream.createClip({
//       playbackId,
//       startTime,
//       endTime,
//       name: `Clip_${endTime}`,
//     });
//     console.log("Clip creation initiated:", clipResult);
//     const clipData = clipResult.data;

//     // Store initial clip information in database
//     const clip = await prisma.clip.create({
//       data: {
//         stream: { connect: { streamId: streamId } },
//         startTime: new Date(startTime),
//         endTime: new Date(endTime),
//         assetId: clipData?.asset.id,
//         clipIndex: clipIndex,
//         status: 'PROCESSING'
//       }
//     });
//     console.log('Initial clip record created in database:', clip);

//     // Wait for asset to be ready
//     console.log('Waiting for asset to be ready...');
//     const asset = await waitForAssetReady(clipData?.asset.id!);
//     console.log('Asset is ready for download.');

//     // Download the clip
//     console.log(`Downloading clip from URL: ${asset.downloadUrl}`);
//     const videoPath = await downloadClip(asset.downloadUrl);
//     console.log(`Clip downloaded and saved to: ${videoPath}`);

//     // Create GIF
//     console.log('Creating GIF from the downloaded clip...');
//     const gifPath = await createGifFromVideo(videoPath);
//     console.log(`GIF created and saved to: ${gifPath}`);

//     // Upload GIF to Cloudinary
//     console.log('Uploading GIF to Cloudinary...');
//     const cloudinaryResponse = await uploadGifToTheCloud(
//       gifPath,
//       `${streamId}_${clipIndex}`,
//       `clip_gifs/${streamId}`
//     );
//     console.log('GIF uploaded to Cloudinary:', cloudinaryResponse.secure_url);

//     // Update clip record in the database
//     const updatedClip = await prisma.clip.update({
//       where: { id: clip.id },
//       data: {
//         downloadUrl: asset.downloadUrl,
//         gifUrl: gifPath,
//         cloudinaryUrl: cloudinaryResponse.secure_url,
//         status: 'READY'
//       }
//     });
//     console.log('Clip record updated in database:', updatedClip);

//     // Clean up
//     console.log(`Cleaning up temporary video file: ${videoPath}`);
//     await fs.unlink(videoPath);
//     console.log('Temporary video file deleted.');

//     console.log(`GIF creation process completed for clip from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    
//     return updatedClip;
//   } catch (error) {
//     console.error("Error in createClipAndStoreLocally:", error);
//     // If an error occurs after the initial clip creation, update the status to FAILED
//     if (clip) {
//       await prisma.clip.update({
//         where: { id: clip.id },
//         data: { status: 'FAILED' }
//       });
//     }
//     throw error;
//   }
// }

async function createClipAndStoreLocally(playbackId: string, streamId: string) {
  console.log(`Starting clip creation process for stream ID: ${streamId}`);
  const now = Date.now()
  const startTime = now - 30000;
  const endTime = now;

  try {
    const clipCount = await prisma.clip.count({ where: { streamId } });
    const clipIndex = clipCount + 1;

    const clipResult = await livepeer.stream.createClip({
      playbackId,
      startTime,
      endTime,
      name: `Clip_${endTime}`,
    });

    const clip = await prisma.clip.create({
      data: {
        stream: { connect: { streamId } },
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        assetId: clipResult.data?.asset?.id!,
        clipIndex,
        status: 'PROCESSING'
      }
    });

    const asset = await waitForAssetReady(clipResult.data?.asset.id!);
    const videoPath = await downloadClip(asset.downloadUrl);
    const gifPath = await createGifFromVideo(videoPath);

    const cloudinaryResponse = await uploadGifToTheCloud(
      gifPath,
      `${streamId}_${clipIndex}`,
      `clip_gifs/${streamId}`
    );

    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        downloadUrl: asset.downloadUrl,
        gifUrl: gifPath,
        cloudinaryUrl: cloudinaryResponse.secure_url,
        status: 'READY'
      }
    });

    await fs.unlink(videoPath);
    console.log(`Clip creation completed for stream ${streamId}, clip ${clipIndex}, and the cloudinary url is: ${cloudinaryResponse.secure_url}`);

  } catch (error) {
    console.error(`Error creating clip for stream ${streamId}:`, error);
    await prisma.clip.updateMany({
      where: { streamId, status: 'PROCESSING' },
      data: { status: 'FAILED' }
    });
    throw error;
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
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 5 seconds before checking again
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

  export async function getLatestClipFromStream(streamer: string, streamId: string) {
    try {
      const stream = await prisma.stream.findUnique({
        where: { streamId: streamId },
        include: {
          clips: {
            orderBy: { clipIndex: 'desc' },
            take: 8
          }
        }
      });
  
      if (!stream || stream.clips.length === 0) {
        console.log(`No clips found for the stream of ${streamer}. Starting clip creation process.`);
        startClipCreationProcess(streamId);
        return {
          hasClips: false,
          streamId: streamId,
          isProcessing: false
        };
      }
  
      const latestClip = stream.clips[0];
      console.log('in here, the latest clip is: ', latestClip)
      
      if (latestClip.status === 'PROCESSING') {
        return {
          hasClips: true,
          isProcessing: true,
          streamId: streamId,
          index: latestClip.clipIndex
        };
      }
  
      return {
        hasClips: true,
        isProcessing: false,
        gifUrl: latestClip.cloudinaryUrl,
        index: latestClip.clipIndex,
        livepeerStreamId: streamId
      };
    } catch (error) {
      console.error("Error in getLatestClipFromStream:", error);
      return null;
    }
  }

  export async function startClipCreationProcess(streamId: string) {
    const stream = await prisma.stream.findUnique({ where: { streamId } });
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
  
    // Add initial job to the queue
    await clipQueue.add('create-clip', { streamId, playbackId: stream.playbackId }, {
      repeat: {
        every: 480000, // Repeat every 480 seconds - 8 minutes
      },
      jobId: `clip-${streamId}`, // Unique job ID for this stream
    });
  }
  
  export async function processClipJob(job: Job) {
    const { streamId, playbackId } = job.data;
  
    try {
      // Check stream status with Livepeer
      const livepeerResponse = await livepeer.stream.get(streamId);
      const livepeerStream = livepeerResponse.stream;
  
      if (!livepeerStream || !livepeerStream.isActive) {
        console.log(`Stream ${streamId} is no longer active. Ending stream and removing job from queue.`);
        await handleStreamEnd(streamId);
        
        try {
          await clipQueue.removeRepeatableByKey(job.repeatJobKey);
        } catch (removeError) {
          console.warn(`Failed to remove job ${job.id}. It may have already been removed or locked: ${removeError.message}`);
        }
        
        return;
      }
  
      console.log(`Creating clip for stream ${streamId}`);
      
      const now = Date.now();
      const startTime = now - 30000; // 30 seconds ago
      const endTime = now;
  
      // Create clip request to Livepeer
      const clipResult = await livepeer.stream.createClip({
        playbackId,
        startTime,
        endTime,
        name: `Clip_${endTime}`,
      });
  
      const clipData = clipResult.data;

      const clipCount = await prisma.clip.count({
        where: { streamId: streamId }
      });

      if (clipCount >= 8) {
        const oldestClip = await prisma.clip.findFirst({
          where: { streamId: streamId },
          orderBy: { clipIndex: 'asc' }
        });
        if (oldestClip) {
          await prisma.clip.delete({ where: { id: oldestClip.id } });
        }
      }
  
      // Create the new clip with the next index
      const newClipIndex = (clipCount % 8) + 1;
  
      // Store initial clip information in database
      const clip = await prisma.clip.create({
        data: {
          stream: { connect: { streamId: streamId } },
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          assetId: clipData?.asset.id,
          status: 'PROCESSING',
          clipIndex: newClipIndex
        }
      });
  
      // Wait for asset to be ready
      const asset = await waitForAssetReady(clipData?.asset.id!);
  
      // Download the clip
      const videoPath = await downloadClip(asset.downloadUrl);
  
      // Create GIF
      const gifPath = await createGifFromVideo(videoPath);
  
      // Upload GIF to Cloudinary
      const cloudinaryResponse = await uploadGifToTheCloud(
        gifPath,
        `${streamId}_${clip.id}`,
        `clip_gifs/${streamId}`
      );
  
      // Update clip record in the database
      await prisma.clip.update({
        where: { id: clip.id },
        data: {
          downloadUrl: asset.downloadUrl,
          gifUrl: gifPath,
          cloudinaryUrl: cloudinaryResponse.secure_url,
          status: 'READY'
        }
      });
  
      // Clean up
      await fs.unlink(videoPath);
      await fs.unlink(gifPath);
  
      console.log(`Clip creation completed for stream ${streamId}, and the cloudinary response is: ${cloudinaryResponse.secure_url}`);
  
    } catch (error) {
      console.error(`Error processing clip for stream ${streamId}:`, error);
      
      if (error?.message?.includes('not found')) {
        await handleStreamEnd(streamId);
        
        try {
          await clipQueue.removeRepeatableByKey(job.repeatJobKey);
        } catch (removeError) {
          console.warn(`Failed to remove job ${job.id}. It may have already been removed or locked: ${removeError.message}`);
        }
      } else {
        // Update any clips in PROCESSING state to FAILED
        await prisma.clip.updateMany({
          where: { streamId, status: 'PROCESSING' },
          data: { status: 'FAILED' }
        });
        throw error; // This will mark the job as failed for other types of errors
      }
    }
  }

  async function handleStreamEnd(streamId: string) {
    try {
      await prisma.stream.update({
        where: { streamId },
        data: { 
          status: 'ENDED', 
          endedAt: new Date() 
        }
      });
      console.log(`Stream ${streamId} has been marked as ended in the database.`);
    } catch (error) {
      console.error(`Error updating stream status for ${streamId}:`, error);
    }
  }
  
  export async function stopClipCreationProcess(streamId: string) {
    const stream = await prisma.stream.findUnique({
      where: { streamId: streamId }
    });
  
    if (stream && stream.clipCreationIntervalId) {
      clearInterval(parseInt(stream.clipCreationIntervalId));
      await prisma.stream.update({
        where: { streamId: streamId },
        data: { clipCreationIntervalId: null }
      });
      console.log(`Stopped clip creation process for stream ${streamId}`);
    }
  }