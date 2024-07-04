import dotenv from 'dotenv';
import { Frog } from "frog";
import { serve } from "@hono/node-server";
import { serveStatic } from "frog/serve-static";
import { SECRET, FILEBASE_API_TOKEN, DUMMY_BOT_SIGNER, NEYNAR_DUMMY_BOT_API_KEY } from '../env/server-env';
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

interface HonoFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: string;
  name: string;
  lastModified: number;
}


// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { ankyGenesis } from './routes/anky-genesis'
import { ankyFrames } from './routes/ankyFrame'
import { zurfFrame } from './routes/zurf'
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
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Add any other origins as needed
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

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/video', async (c) => {
  console.log("Entering /video route");

  try {
    const formData = await c.req.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return c.json({ error: 'No video file uploaded' }, 400);
    }

    const uuid = uuidv4();
    const filename = `${uuid}.mov`;
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename);
    const gifPath = path.join(process.cwd(), 'public', 'gifs', `${uuid}.gif`);
    const farcasterGifPath = path.join(process.cwd(), 'public', 'gifs_farcaster', `${uuid}_farcaster.gif`);
    
    const user = {
      username: "jpfraneto",
      craft: "self-inquiry",
      pfp_url: "https://dl.openseauserdata.com/cache/originImage/files/9bb46d16f20ed3d54ae01d1aeac89e23.png"
    }

    console.log("Saving video file to:", videoPath);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(videoPath, Buffer.from(arrayBuffer));
    console.log("Video file saved");

    // Process video to GIF
    console.log('Processing video to GIF...');
    await processVideo(videoPath, gifPath);
    console.log("GIF processing completed");

    // Create enhanced Farcaster GIF
    console.log('Creating enhanced Farcaster GIF...');
    await createEnhancedGif(gifPath, farcasterGifPath, user);
    console.log("Enhanced Farcaster GIF created");

    // Upload Farcaster GIF to IPFS
    console.log('Uploading Farcaster GIF to IPFS...');
    const farcasterGifBuffer = await fs.readFile(farcasterGifPath);
    const farcasterGifBlob = new Blob([farcasterGifBuffer], { type: 'image/gif' });
    const ipfsHash = await mintclub.ipfs.add(FILEBASE_API_TOKEN!, farcasterGifBlob);

    // Save to database
    console.log('Saving to database...');
    const videoRecord = await prisma.video.create({
      data: {
        id: uuid,
        originalName: file.name,
        videoPath: `/videos/${filename}`,
        gifPath: `/gifs/${uuid}.gif`,
        farcasterGifPath: `/gifs_farcaster/${uuid}_farcaster.gif`,
        ipfsHash: ipfsHash,
      },
    });

    let replyOptions = {
      text: "hello world",
      embeds: [{url: `https://api.anky.bot/zurf/${uuid}`}],
      parent: "0xbc7c9fd8a6278ed1f6f09c4990f42d504ebe17e7",
      signer_uuid: DUMMY_BOT_SIGNER,
    };

    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      replyOptions,
      {
        headers: {
          api_key: NEYNAR_DUMMY_BOT_API_KEY,
        },
      }
    );

    console.log('Upload complete! cast shared!', response.data);
    return c.json({ videoRecord, castHash: response.data.hash });

  } catch (error) {
    console.error("There was an error processing the video", error);
    return c.json({ error: error.message }, 500);
  }
});

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