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
import mime from 'mime-types';
import { Readable } from 'stream'
import ffmpeg from 'fluent-ffmpeg';
import { v2 as cloudinary } from 'cloudinary';
import { uploadVideoToTheCloud, uploadGifToTheCloud } from '../utils/cloudinary';
import { publishCastToTheProtocol } from '../utils/cast';


// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { app as stream } from './routes/stream'
import { ankyGenesis } from './routes/anky-genesis'
import { ankyFrames } from './routes/ankyFrame'
import { vibraFrame } from './routes/vibra'
import { extractWordBeforeWaveEmoji } from '../utils/zurf';
import { sadhanaFrame } from './routes/sadhana';
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

  await next();
});

app.route('/', landing);
app.route('/anky', ankyFrames)
app.route('/anky-genesis', ankyGenesis)
app.route('/vibra', vibraFrame)
app.route('/stream', stream)
app.route('/sadhana', sadhanaFrame)

app.get("/aloja", (c) => {
  return c.json({
    134: 124,
  });
});


app.post('/video', async (c) => {
  const logProgress = (message: string) => {
    console.log(`Progress: ${message}`);
  };

  let tempFiles: string[] = [];

  try {
    logProgress('Receiving form data...');
    const formData = await c.req.formData();
    const file = formData.get('video') as File | null;
    const farcasterUserString = formData.get('farcasterUser') as string | null;

    if (!file) {
      throw new Error('No video file uploaded');
    }

    const farcasterUser = farcasterUserString ? JSON.parse(farcasterUserString) : null;
    const user = {
      fid : farcasterUser.fid || 16098,
      username: farcasterUser?.username || "jpfraneto",
      craft: farcasterUser ? extractWordBeforeWaveEmoji(farcasterUser.bio) : "",
      pfp_url: farcasterUser?.pfp || "https://dl.openseauserdata.com/cache/originImage/files/9bb46d16f20ed3d54ae01d1aeac89e23.png"
    };

    const uuid = uuidv4();
    const fileExtension = mime.extension(file.type) || 'mp4';
    const filename = `${uuid}.${fileExtension}`;
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename);
    const gifPath = path.join(process.cwd(), 'public', 'gifs', `${uuid}.gif`);
    const farcasterGifPath = path.join(process.cwd(), 'public', 'gifs_farcaster', `${uuid}_farcaster.gif`);
    
    tempFiles = [videoPath, gifPath, farcasterGifPath];

    // Save video file locally
    logProgress('Saving video file...');
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(videoPath, Buffer.from(arrayBuffer));

    // Check if the file is actually a video
    logProgress('Verifying video file...');
    const fileInfo = await getFileInfo(videoPath);
    if (!fileInfo.isVideo) {
      throw new Error('Uploaded file is not a valid video');
    }

    // Upload video to the cloud
    logProgress('Uploading video to cloud...');
    const cloudinaryVideoUploadResult = await uploadVideoToTheCloud(videoPath, `uploaded_videos/${uuid}`);
    console.log("the cloudingatasd", cloudinaryVideoUploadResult)
    // Transform the video into a gif
    logProgress('Creating GIF from video...');
    await createAndSaveLocallyCompressedGifFromVideo(videoPath, gifPath);

    // Append that gif to the static background and create a new gif (with user information also)
    logProgress('Creating framed GIF...');
    await createFrameGifFromVideoGif(gifPath, farcasterGifPath, user);

    logProgress('Uploading GIF to cloud...');
    const cloudinaryGifUploadResult = await uploadGifToTheCloud(farcasterGifPath, `farcaster_gifs/${uuid}`);

    logProgress('Publishing cast...');
    let castOptions = {
      text: "",
      embeds: [{url: `https://api.anky.bot/zurf/video/${uuid}`}],
      parent: "0xbc7c9fd8a6278ed1f6f09c4990f42d504ebe17e7",
      signer_uuid: DUMMY_BOT_SIGNER,
    };

    const castResponse = await publishCastToTheProtocol(castOptions, NEYNAR_DUMMY_BOT_API_KEY);

    logProgress('Process complete!');

    let zurfUser = await prisma.zurfUser.findUnique({
      where: { fid: user.fid }
    })

    if (!zurfUser) {
      zurfUser = await prisma.zurfUser.create({
        data: {
          fid: user.fid,
          username: user.username,
          craft: user.craft
        }
      })
    }

    const prismaResponse = await prisma.zurfVideo.create({
      data: {
        id: uuid,
        originalName: "hello world",
        gifLink: cloudinaryGifUploadResult.secure_url,
        videoLink: cloudinaryVideoUploadResult.secure_url,
        castHash: castResponse.hash,
        ZurfUser: {
          connect: { fid: user.fid }
        }
      }
    })

    console.log("the prisma response is: ", prismaResponse)

    // model ZurfVideo {
    //   id             String   @id @default(uuid())
    //   originalName   String
    //   gifLink        String
    //   videoLink      String?
    //   castHash       String?
    //   createdAt      DateTime @default(now())
    //   updatedAt      DateTime @updatedAt
    //   ZurfUser       ZurfUser?                  @relation(fields: [zurfUserFid], references: [fid])
    //   zurfUserFid    Int?
    // }

    return c.json({ 
      gifLink: cloudinaryGifUploadResult.secure_url,
      castHash: castResponse.hash 
    });

  } catch (error) {
    console.error("There was an error processing the video", error);
    return c.json({ error: error }, 500);
  } finally {
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
        console.log(`Deleted temporary file: ${file}`);
      } catch (err) {
        console.error(`Failed to delete temporary file ${file}:`, err);
      }
    }
  }
});

async function getFileInfo(filePath: string): Promise<{ isVideo: boolean, format?: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error('Failed to probe file'));
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        resolve({
          isVideo: !!videoStream,
          format: metadata.format.format_name
        });
      }
    });
  });
}

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