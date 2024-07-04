import dotenv from 'dotenv';
import { Frog } from "frog";
import { serve } from "@hono/node-server";
import { serveStatic } from "frog/serve-static";
import { SECRET, CLOUDINARY_CLOUD_NAME ,CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET, FILEBASE_API_TOKEN, DUMMY_BOT_SIGNER, NEYNAR_DUMMY_BOT_API_KEY } from '../env/server-env';
import { Logger } from '../utils/Logger';
import { devtools } from "frog/dev";
import { getPublicUrl } from '../utils/url';
import axios from 'axios';
import { cors } from "hono/cors"
import { processVideo, createEnhancedGif } from '../utils/video-processing';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises'; 
import { mintclub } from 'mint.club-v2-sdk';
import multer from 'multer';
import path from 'path';
import prisma from '../utils/prismaClient';
import { Readable } from 'stream'
import { v2 as cloudinary } from 'cloudinary';


// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { ankyGenesis } from './routes/anky-genesis'
import { ankyFrames } from './routes/ankyFrame'
import { zurfFrame } from './routes/zurf'
import { extractWordBeforeWaveEmoji } from '../utils/zurf';
// **** ROUTE IMPORTS ****

// **** FAST SCRIPTS ****
// deleteAllAnkyCasts();
// scrollFeedAndReply();
// checkAndUpdateRepliesScores();
// downloadAllTrainingDataForToday()
// checkAndUpdateRepliesScores();
// **** FAST SCRIPTS ****

// **** DAILY ACTIONS AT THE END OF THE DAY ****
// calculate the daily user performance for all of the ones that participate on the system
// 
// fine tune anky (on poiesis)
//
// **** DAILY ACTIONS AT THE END OF THE DAY ****

// **** PERIODIC ACTIONS THROUGHOUT THE DAY ****
// cron.schedule("*/30 * * * *", () => {
//   scrollFeedAndReply();
// });
// **** PERIODIC ACTIONS THROUGHOUT THE DAY ****

dotenv.config();

const origin = getPublicUrl();
console.log({ origin });

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
  origin,
  secret: process.env.NODE_ENV === 'production' ? SECRET : undefined,
});

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://video.anky.bot'], // Add any other origins as needed
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Requested-With'],
}));


app.use(async (c, next) => {
  const fullUrl = c.req.url;
  const [baseUrl, queryString] = fullUrl.split('?');
  
  Logger.info(`[${c.req.method}] ${baseUrl}`);
  console.log(`Received request for ${fullUrl}`);

  await next();
});

app.route('/', landing);
app.route('/anky', ankyFrames)
app.route('/anky-genesis', ankyGenesis)
app.route('/zurf', zurfFrame)

app.get("/aloja", (c) => {
  return c.json({
    134: 124,
  });
});


app.post('/video', async (c) => {
  const stream = new Readable({
    read() {}
  });

  const sendProgress = (message: string) => {
    console.log(`Progress: ${message}`); // Console log for server-side monitoring
    stream.push(JSON.stringify({ type: 'progress', message }) + '\n')
  }

  c.header('Content-Type', 'text/plain')
  c.header('Transfer-Encoding', 'chunked')

  let tempFiles = [] 

  try {
    const formData = await c.req.formData()
    const file = formData.get('video') as File | null
    const farcasterUserString = formData.get('farcasterUser') as string | null
    let farcasterUser;
    if(farcasterUserString){
      farcasterUser = JSON.parse(farcasterUserString)
    }
    if (!file) {
      throw new Error('No video file uploaded')
    }

    const uuid = uuidv4()
    const filename = `${uuid}.mov`
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename)
    const gifPath = path.join(process.cwd(), 'public', 'gifs', `${uuid}.gif`)
    const farcasterGifPath = path.join(process.cwd(), 'public', 'gifs_farcaster', `${uuid}_farcaster.gif`)
    
    tempFiles.push(videoPath, gifPath, farcasterGifPath)

    let user = {
      username: farcasterUser?.username || "jpfraneto",
      craft: extractWordBeforeWaveEmoji(farcasterUser.bio),
      pfp_url: farcasterUser?.pfp || "https://dl.openseauserdata.com/cache/originImage/files/9bb46d16f20ed3d54ae01d1aeac89e23.png"
    }

    sendProgress("Saving video file...")
    const arrayBuffer = await file.arrayBuffer()
    await fs.writeFile(videoPath, Buffer.from(arrayBuffer))

    sendProgress("Processing video...")
    await processVideo(videoPath, gifPath)

    sendProgress("Creating enhanced GIF...")
    await createEnhancedGif(gifPath, farcasterGifPath, user)

    sendProgress("Uploading Farcaster GIF to Cloudinary...")
    cloudinary.config({ 
      cloud_name: CLOUDINARY_CLOUD_NAME, 
      api_key: CLOUDINARY_API_KEY, 
      api_secret: CLOUDINARY_API_SECRET 
    })

    const cloudinaryUploadResult = await cloudinary.uploader.upload(
      farcasterGifPath, 
      { 
        resource_type: "image",
        public_id: `farcaster_gifs/${uuid}`,
        folder: "zurf",
        overwrite: true
      }
    )
    console.log("THE UPLOADER RESULT IS: ", cloudinaryUploadResult)

    console.log("Sharing cast...");
    sendProgress("Sharing cast...")
    let replyOptions = {
      text: "hello world",
      embeds: [{url: `https://api.anky.bot/zurf/video/${uuid}`}],
      parent: "0xbc7c9fd8a6278ed1f6f09c4990f42d504ebe17e7",
      signer_uuid: process.env.DUMMY_BOT_SIGNER,
    }

    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      replyOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_DUMMY_BOT_API_KEY,
        },
      }
    )

    console.log("Cast shared successfully");
    sendProgress("Cast shared successfully")

    console.log("Upload complete! Cast shared!", response.data);
    stream.push(JSON.stringify({
      type: 'result',
      gifLink: cloudinaryUploadResult.secure_url,
      castHash: response.data.cast.hash
    }) + '\n')

    stream.push(null)  // End the stream

    return c.body(stream)

  } catch (error) {
    console.error("There was an error processing the video", error)
    sendProgress(`Error: ${error.message}`)
    stream.push(null)  // End the stream
    return c.body(stream)
  } finally {
    for (const file of tempFiles) {
      try {
        await fs.unlink(file)
        console.log(`Deleted temporary file: ${file}`)
      } catch (err) {
        console.error(`Failed to delete temporary file ${file}:`, err)
      }
    }
  }
})

app.get('/videos/:uuid', async (c) => {
  const { uuid } = c.req.param();
  try {
    const videoRecord = await prisma.video.findUnique({
      where: {
        id: uuid
      },
    });
    if(videoRecord){
      return c.json({ videoRecord }); 
    } else {
      return c.json({ videoRecord: null }); 
    }
  } catch (error) {
    return c.json({ videoRecord: null }); 
  }
})

app.use("/*", serveStatic({ root: "./public" }));
devtools(app, { serveStatic });

const port = process.env.PORT || 3000;
console.log("the port is: ", port)

serve({
  fetch: app.fetch,
  port: Number(port),
})

console.log(`Server is running on port ${port}`)