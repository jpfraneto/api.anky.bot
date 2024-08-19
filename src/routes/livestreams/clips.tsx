import { uploadGifToTheCloud, uploadInitialGifOfFrame } from '../../../utils/cloudinary'
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

async function createClipAndStoreLocally(playbackId: string, streamId: string, handle: string) {
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

    await uploadGifToTheCloud(
      gifPath,
      `user_gif_${handle}`,
      'user_gifs'
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

async function waitForAssetReady(assetId: string, maxAttempts: number = 30): Promise<any> {
  console.log(`Waiting for asset ${assetId} to be ready...`);
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Checking asset status. Attempt ${attempts}...`);
    
    try {
      const response = await livepeer.asset.get(assetId);
      const asset = response.asset;
      console.log("Asset status:", asset?.status);

      if (asset?.status?.phase === "ready") {
        console.log(`Asset ${assetId} is ready after ${attempts} attempts.`);
        return asset;
      }

      if (asset?.status?.phase === "failed") {
        console.error(`Asset ${assetId} failed to process. Error: ${asset.status.errorMessage}`);
        return null; // Return null instead of throwing an error
      }

      console.log(`Asset not ready. Current status: ${asset?.status?.phase}. Waiting 10 seconds before next check.`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before checking again
    } catch (error) {
      console.error(`Error checking asset status: ${error.message}`);
      if (attempts >= maxAttempts) {
        return null; // Return null instead of throwing an error
      }
    }
  }

  console.error(`Asset ${assetId} not ready after ${maxAttempts} attempts.`);
  return null; // Return null instead of throwing an error
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

  

  export async function startClippingProcess(playbackId: string, streamId: string, handle: string) {
    console.log(`Setting up interval for clipping process. Playback ID: ${playbackId}`);
    setInterval(async () => {
      console.log('Interval triggered. Creating new clip...');
      try {
        await createClipAndStoreLocally(playbackId, streamId, handle);
      } catch (error) {
        console.error("Error in clipping process:", error);
      }
    }, 60000); // Run every 60 seconds
  }

  export async function getLatestClipFromStream(stream: any, streamer: string) {
    try {
      const streamId = stream.streamId;
      if (!stream || stream.clips.length === 0) {
        console.log(`No clips found for the stream of ${streamer}. Starting clip creation process.`);
        startClipCreationProcess(streamId, streamer);
        return {
          hasClips: false,
          streamId: streamId,
          isProcessing: false
        };
      }
  
      console.log("the clips are: ", stream.clips);
      
      // Find the first non-processing clip
      const latestProcessedClip = stream.clips.find(clip => clip.status !== 'PROCESSING');
      const latestClip = stream.clips[0];
  
      if (!latestProcessedClip) {
        // All clips are processing
        return {
          hasClips: true,
          isProcessing: true,
          streamId: streamId,
          index: latestClip.clipIndex
        };
      }
  
      return {
        hasClips: true,
        isProcessing: latestClip.status === 'PROCESSING',
        gifUrl: latestProcessedClip.cloudinaryUrl,
        index: latestProcessedClip.clipIndex,
        livepeerStreamId: streamId,
        totalClips: stream.clips.length 
      };
    } catch (error) {
      console.error("Error in getLatestClipFromStream:", error);
      return null;
    }
  }

  export async function startClipCreationProcess(streamId: string, handle: string) {
    console.log(`Starting clip creation process for stream ${streamId}`);
    const stream = await prisma.stream.findUnique({ where: { streamId } });
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
  
    // Add a repeating job that starts after 8 minutes
    await clipQueue.add('create-clip', { streamId, playbackId: stream.playbackId, handle }, {
      repeat: {
        every: 480000, // Repeat every 480 seconds - 8 minutes
        immediately: false, // This ensures the repeat doesn't start immediately
      },
      jobId: `clip-${streamId}-repeat`, // Unique job ID for this stream's repeating job
      delay: 480000, // Delay the start of the repeating job by 8 minutes
    });
  }

  export async function stopClipCreationProcess(streamId: string) {
    console.log(`Stopping clip creation process for stream ${streamId}`);
  
    try {
      // Remove the repeating job for this stream
      const jobId = `clip-${streamId}-repeat`;
      const removed = await clipQueue.removeRepeatableByKey(jobId);
  
      if (removed) {
        console.log(`Successfully removed repeating job for stream ${streamId}`);
      } else {
        console.log(`No repeating job found for stream ${streamId}`);
      }
  
      // Optionally, you can also remove any pending jobs for this stream
      const pendingJobs = await clipQueue.getJobs(['delayed', 'waiting']);
      for (const job of pendingJobs) {
        if (job.data.streamId === streamId) {
          await job.remove();
          console.log(`Removed pending job ${job.id} for stream ${streamId}`);
        }
      }
  
      // Update the stream status in the database if needed
      await prisma.stream.update({
        where: { streamId },
        data: { status: 'ENDED' }
      });
  
      console.log(`Clip creation process stopped for stream ${streamId}`);
    } catch (error) {
      console.error(`Error stopping clip creation process for stream ${streamId}:`, error);
      throw error;
    }
  }
  
  export async function processClipJob(job: Job) {
    const { streamId, playbackId, handle } = job.data;
  
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
      console.log("now this gif will also be added to as the first one of the frame")
      await uploadGifToTheCloud(
        gifPath,
        `user_gif_${handle}`,
        'user_gifs'
      );
      console.log("after adding this gif as the first one of the frame")

  
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

  export async function createFirstStreamGif(streamId: string, playbackId: string, handle: string) {
    console.log(`Starting createFirstStreamGif for streamId: ${streamId}, playbackId: ${playbackId}, handle: ${handle}`);
    try {
      const now = Date.now();
      const startTime = now - 16180; // 16.18 seconds ago
      const endTime = now;
      console.log(`Clip time range: start=${new Date(startTime).toISOString()}, end=${new Date(endTime).toISOString()}`);
  
      console.log(`Creating clip with Livepeer for playbackId: ${playbackId}`);
      const clipResult = await livepeer.stream.createClip({
        playbackId,
        startTime,
        endTime,
        name: `First_Clip_${streamId}`,
      });
  
      const clipData = clipResult.data;
      console.log(`Clip created successfully. Asset ID: ${clipData?.asset.id}`);
  
      console.log(`Waiting for asset to be ready...`);
      const asset = await waitForAssetReady(clipData?.asset.id!);
      console.log(`Asset is ready. Download URL: ${asset.downloadUrl}`);
  
      console.log(`Downloading clip...`);
      const videoPath = await downloadClip(asset.downloadUrl);
      console.log(`Clip downloaded to: ${videoPath}`);
  
      console.log(`Creating GIF from video...`);
      const gifPath = await createGifFromVideo(videoPath);
      console.log(`GIF created at: ${gifPath}`);
  
      console.log(`Uploading GIF to Cloudinary...`);
      const cloudinaryResponse = await uploadInitialGifOfFrame(
        gifPath,
        `user_gif_${handle}`
      );
      console.log(`GIF uploaded to Cloudinary. URL: ${cloudinaryResponse.secure_url}`);
  
      console.log(`Cleaning up temporary files...`);
      await fs.unlink(videoPath);
      await fs.unlink(gifPath);
      console.log(`Temporary files deleted.`);
  
      console.log(`First stream GIF creation completed successfully for ${handle}`);
    } catch (error) {
      console.error(`Error creating first stream GIF for streamId: ${streamId}, handle: ${handle}:`, error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
    }
  }

  export async function createFinalStreamGif(streamId: string, playbackId: string, handle: string) {
    console.log(`Starting createFinalStreamGif for streamId: ${streamId}, playbackId: ${playbackId}, handle: ${handle}`);
    try {
      const now = Date.now();
      const startTime = now - 16180; // 16.18 seconds ago
      const endTime = now;
      console.log(`Clip time range: start=${new Date(startTime).toISOString()}, end=${new Date(endTime).toISOString()}`);
  
      console.log(`Creating clip with Livepeer for playbackId: ${playbackId}`);
      const clipResult = await livepeer.stream.createClip({
        playbackId,
        startTime,
        endTime,
        name: `First_Clip_${streamId}`,
      });
  
      const clipData = clipResult.data;
      console.log(`Clip created successfully. Asset ID: ${clipData?.asset.id}`);
  
      console.log(`Waiting for asset to be ready...`);
      const asset = await waitForAssetReady(clipData?.asset.id!);
      console.log(`Asset is ready. Download URL: ${asset.downloadUrl}`);
  
      console.log(`Downloading clip...`);
      const videoPath = await downloadClip(asset.downloadUrl);
      console.log(`Clip downloaded to: ${videoPath}`);
  
      console.log(`Creating GIF from video...`);
      const gifPath = await createLastGifFromVideo(videoPath);
      console.log(`GIF created at: ${gifPath}`);
  
      console.log(`Uploading GIF to Cloudinary...`);
      const cloudinaryResponse = await uploadInitialGifOfFrame(
        gifPath,
        `user_gif_${handle}`,
      );
      console.log(`GIF uploaded to Cloudinary. URL: ${cloudinaryResponse.secure_url}`);
  
      console.log(`Cleaning up temporary files...`);
      await fs.unlink(videoPath);
      await fs.unlink(gifPath);
      console.log(`Temporary files deleted.`);
  
      console.log(`First stream GIF creation completed successfully for ${handle}`);
    } catch (error) {
      console.error(`Error creating first stream GIF for streamId: ${streamId}, handle: ${handle}:`, error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
    }
  }

  async function createLastGifFromVideo(videoPath: string): Promise<string> {
    console.log(`Starting square GIF creation process for video: ${videoPath}`);
    const outputDir = path.join(process.cwd(), 'clip-gifs');
    console.log(`Ensuring output directory exists: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
  
    const outputPath = path.join(outputDir, `square_gif_${Date.now()}.gif`);
    console.log(`Output square GIF will be saved to: ${outputPath}`);
  
    console.log('Executing ffmpeg command to create square GIF with end text...');
    const ffmpegCommand = `
      ffmpeg -i ${videoPath} -filter_complex "
        [0:v] fps=10,
               scale=iw*min(320/iw\\,320/ih):ih*min(320/iw\\,320/ih),
               pad=320:320:(320-iw*min(320/iw\\,320/ih))/2:(320-ih*min(320/iw\\,320/ih))/2:black,
               setsar=1:1 [v0];
        [v0] split [v1][v2];
        [v1] trim=duration=2.8,setpts=PTS-STARTPTS [trimmed];
        [v2] drawtext=fontfile=/path/to/font.ttf:fontsize=24:fontcolor=white:x=(w-tw)/2:y=(h-th)/2:text='This stream is now offline':enable='gte(t,2.8)' [text];
        [trimmed][text] concat=n=2:v=1 [out]
      " -map "[out]" -c:v gif ${outputPath}
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
  
    console.log(`Square GIF with end text created successfully: ${outputPath}`);
    return outputPath;
  }