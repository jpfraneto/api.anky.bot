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
import { createAndSaveLocallyCompressedGifFromVideo, createFrameGifFromVideoGif } from '../utils/video-processing';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises'; 
import { mintclub } from 'mint.club-v2-sdk';
import multer from 'multer';
import path from 'path';
import prisma from '../utils/prismaClient';
import { Readable } from 'stream'
import { v2 as cloudinary } from 'cloudinary';
import { uploadVideoToTheCloud, uploadGifToTheCloud } from '../utils/cloudinary';
import { publishCastToTheProtocol } from '../utils/cast';


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
  origin: ["https://www.guarpcast.com", 'http://localhost:3000', 'http://localhost:5173', 'https://video.anky.bot'], // Add any other origins as needed
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

    if (!file) {
      throw new Error('No video file uploaded')
    }

    const farcasterUser = farcasterUserString ? JSON.parse(farcasterUserString) : null
    const user = {
      username: farcasterUser?.username || "jpfraneto",
      craft: farcasterUser ? extractWordBeforeWaveEmoji(farcasterUser.bio) : "",
      pfp_url: farcasterUser?.pfp || "https://dl.openseauserdata.com/cache/originImage/files/9bb46d16f20ed3d54ae01d1aeac89e23.png"
    }

    const uuid = uuidv4()
    const filename = `${uuid}.mov`
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename)
    const gifPath = path.join(process.cwd(), 'public', 'gifs', `${uuid}.gif`)
    const farcasterGifPath = path.join(process.cwd(), 'public', 'gifs_farcaster', `${uuid}_farcaster.gif`)
    
    tempFiles.push(videoPath, gifPath, farcasterGifPath)

    // save video file locally
    const arrayBuffer = await file.arrayBuffer()
    await fs.writeFile(videoPath, Buffer.from(arrayBuffer))

    // upload video to the cloud 
    const cloudinaryVideoUploadResult = await uploadVideoToTheCloud(videoPath, `uploaded_videos/${uuid}`)
    
    // transform the video into a gif
    await createAndSaveLocallyCompressedGifFromVideo(videoPath, gifPath)

    // append that gif to the static background and create a new gif (with user information also)
    await createFrameGifFromVideoGif(gifPath, farcasterGifPath, user)

    const cloudinaryGifUploadResult = await uploadGifToTheCloud(farcasterGifPath, `farcaster_gifs/${uuid}`)
  
    let castOptions = {
      text: "",
      embeds: [{url: `https://api.anky.bot/zurf/video/${uuid}`}],
      parent: "0xbc7c9fd8a6278ed1f6f09c4990f42d504ebe17e7",
      signer_uuid: DUMMY_BOT_SIGNER,
    }

    const castResponse = await publishCastToTheProtocol(castOptions, NEYNAR_DUMMY_BOT_API_KEY)

    const finalVideoProcessingResponse = {
      gifLink: cloudinaryGifUploadResult.secure_url,
      castHash: castResponse.hash
    }

    return c.json({ response: finalVideoProcessingResponse })

  } catch (error) {
    console.error("There was an error processing the video", error)
    return c.json({ error: error }, 500)
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