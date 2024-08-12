import { Button, FrameContext, Frog, TextInput } from 'frog';
import { SECRET } from '../../../env/server-env';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { fileURLToPath } from 'url';


const execAsync = promisify(exec);

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GIF_DIRECTORY = path.join(__dirname, 'generated_gifs');

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
  imageAspectRatio: "1:1",
  secret: process.env.NODE_ENV === 'production' ? SECRET : undefined,
});

async function getFarcasterUserData(username) {
  try {
    const response = await axios.get(`https://api.neynar.com/v1/farcaster/user-by-username?username=${username}&viewerFid=16098`, {
      headers: {
        'api_key': NEYNAR_API_KEY
      }
    });
    console.log("THE RESPONSE IN HERE IS", response.data)
    return response.data.result.user; // Assuming the first result is the correct user
  } catch (error) {
    console.error('Error fetching Farcaster user data:', error);
    return null;
  }
}

app.get("/frame-image/:streamer", async (c) => {
  console.log("IIIIIN HERE")
  const { streamer } = c.req.param();
  try {
    console.log("Generating/retrieving GIF for streamer:", streamer);
  
    const gifPath = path.join(GIF_DIRECTORY, `${streamer}.gif`);
  
    try {
      // Check if the GIF already exists
      await fs.access(gifPath);
      console.log("GIF already exists for", streamer);
      return c.json({ imageUrl: `/generated_gifs/${streamer}.gif` });
    } catch (error) {
      // GIF doesn't exist, need to generate it
      console.log("Generating new GIF for", streamer);
  
      // Fetch user data from Farcaster
      const userData = await getFarcasterUserData(streamer);
      if (!userData) {
        return c.json({ error: "User not found on Farcaster" }, 404);
      }
  
      // Generate the GIF
      const staticImageUrl = userData.pfp.url; // Use the user's profile picture from Farcaster
      console.log("the static image url is: ", staticImageUrl)
      const outputPath = await processAndSaveGif(staticImageUrl, streamer, gifPath);
  
      return c.json({ imageUrl: `/generated_gifs/${streamer}.gif` });
    }
  } catch (error) {
    return c.json({ imageUrl: `/generated_gifs/${streamer}.gif` });
  }

});

app.frame("/:streamer", async (c) => {
  console.log("this is the entry point to the frames world of this streamer")
  const { streamer } = c.req.param();
  console.log("inside the streamer route", streamer)
  // this comes from the frontend
  const buttonIndex = c?.frameData?.buttonIndex
  if(buttonIndex == 1) {
    console.log("inside the button index 1")
    return c.res({
      title: "vibra",
      image: `https://github.com/jpfraneto/images/blob/main/${index}.gif?raw=true`,
      intents: [
         <Button action={`/${streamer}/subscribe`}>Subscribe</Button>,
         <Button action={`/${streamer}/clips/start`}>▶️</Button>,
         <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
         <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>live 📺</Button.Link>,
        ],
  })
  } else {
    console.log("inside the button index 2")
    return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/vibra-square.png?raw=true",
      intents: [
         <Button action={`/${streamer}/clips/start`}>Watch Stream</Button>,
         <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
         <Button.Link href="https://www.vibra.so/android">android</Button.Link>
        ],
  })
  }
})

app.frame("/download-app/:streamer", async (c) => {
  const { streamer } = c.req.param();
  
  return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/vibra-square.png?raw=true",
      intents: [
         <Button action={`/${streamer}/clips/start`}>Watch Stream</Button>,
         <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
         <Button.Link href="https://www.vibra.so/android">android</Button.Link>
        ],
  })
})

async function checkIfUserSubscribed(streamer, viewerFid) {
  // TODO: ADD LOGIC TO CHECK IF THE USER IS SUBSCRIBED
  return true
}

async function getLatestClipFromStream(streamer) {
  // TODO: ADD LOGIC TO GET LATEST CLIP FROM THIS STREAMER
  return `https://github.com/jpfraneto/images/blob/main/3.gif?raw=true`
}


app.frame("/:streamer/clips/start", async (c) => {
  console.log("get the first clip of this streamer")
  const { streamer } = c.req.param();
  const isUserSubscribed = await checkIfUserSubscribed(streamer, c.frameData?.fid)
  const thisClipUrl = await getLatestClipFromStream(streamer)
  console.log("inside the streamer route", streamer)
  const index = 3
  return c.res({
      title: "vibra",
      image: thisClipUrl,
      intents: [
         <Button action={`/${streamer}/subscribe`}>Subscribe</Button>,
         <Button action={`/stream/${streamer}/${index + 1}`}>▶️</Button>,
         <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>live 📺</Button.Link>,
         <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
        ],
  })
})

app.frame("/stream/:streamer/:index", async (c) => {
  const { streamer, index } = c.req.param();
  return c.res({
      title: "vibra",
      image: `https://github.com/jpfraneto/images/blob/main/${index}.gif?raw=true`,
      intents: [
         <Button action={`/stream/${streamer}/${+index-1}`}>◀️</Button>,
         <Button action={`/stream/${streamer}/${+index+1}`}>▶️</Button>,
         <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>live 📺</Button.Link>,
         <Button action={`/mobile-app/${streamer}`}>Mobile App</Button>
        ],
  })
})

app.frame("/mobile-app/:streamer", async (c) => {
  const { streamer } = c.req.param();
  
  return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/vibra-square.png?raw=true",
      intents: [
         <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
         <Button.Link href="https://www.vibra.so/android">android</Button.Link>
        ],
  })
})

app.get("/create-stream", async (c) => {
  console.log('Received request to create a new stream.');
  try {
    const timestamp = new Date().getTime();
    console.log(`Creating stream with timestamp: ${timestamp}`);
    const streamData = {
      name: "test_stream_" + timestamp,
    };
    
    console.log('Calling Livepeer API to create stream...');
    const response = await livepeer.stream.create(streamData);
    const stream = response.stream
    console.log(`Stream created successfully:`, stream);

    console.log(`Stream created successfully. Stream ID: ${stream.id}, Playback ID: ${stream.playbackId}`);

    console.log('Starting the clipping process...');
    startClippingProcess(stream.playbackId, stream.id);

    console.log('Sending response to client.');
    return c.json({
      success: true,
      streamId: stream.id,
      playbackId: stream.playbackId,
    });
  } catch (error) {
    console.error("Error creating stream:", error);
    return c.json({
      success: false,
      error: "Failed to create stream",
    });
  }
});

async function startClippingProcess(playbackId: string, streamId: string) {
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

      // UPLOAD GIF TO AMAZON S3
  
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