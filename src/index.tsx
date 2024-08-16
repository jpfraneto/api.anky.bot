import dotenv from 'dotenv';
import { Frog } from "frog";
import { serve } from "@hono/node-server";
import { serveStatic } from "frog/serve-static";
import { SECRET, CLOUDINARY_CLOUD_NAME ,REDIS_URL,VIBRA_SO_WARPCAST_API_KEY, CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET, FILEBASE_API_TOKEN, DUMMY_BOT_SIGNER, NEYNAR_DUMMY_BOT_API_KEY, NEYNAR_API_KEY, CHISPITA_OXIDA_SIGNER_UUID, AIRSTACK_API_KEY, JPFRANETO_WARPCAST_API_KEY, VIBRA_BOT_WARPCAST_API_KEY } from '../env/server-env';
import { Logger } from '../utils/Logger';
import { devtools } from "frog/dev";
import { getPublicUrl } from '../utils/url';
import axios from 'axios';
import { cors } from "hono/cors"
import { createAndSaveLocallyCompressedGifFromVideo, createFramedGifFromVideo, downloadHLSStream, getVideoDuration, isHLSStream, isValidVideoUrl, queueCastVideoProcessing } from '../utils/video-processing';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises'; 
import { createCanvas, loadImage } from 'canvas';
import { mintclub } from 'mint.club-v2-sdk';
import multer from 'multer';
import cron from 'node-cron';
import path from 'path';
import prisma from '../utils/prismaClient';
import mime from 'mime-types';
import { Readable } from 'stream'
import ffmpeg from 'fluent-ffmpeg';
import { v2 as cloudinary } from 'cloudinary';
import { uploadVideoToTheCloud, uploadGifToTheCloud } from '../utils/cloudinary';
import { fetchCastInformationFromHash, publishCastToTheProtocol } from '../utils/cast';
import { setupWorkers, clipQueue } from '../utils/queue/queueConfig';
import { processClipJob } from './routes/livestreams/clips';

//maiiinn("https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_gif,w_112,h_112/https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/11e5479f-e479-4ba0-2221-97a086f65b00/original", "jpfraneto", "output_gif.gif")

// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { tvFrame as stream } from './routes/stream'
import { vibraFrame } from './routes/vibra'
import { extractWordBeforeWaveEmoji } from '../utils/zurf';
import { moxiefolioFrame } from './routes/moxiefolio';
import { vibraTvFrame } from './routes/vibratv';
import { app as livestreamsRoute } from './routes/livestreams';
import { Redis } from 'ioredis';
import { processData } from '../utils/moxie';
import { checkIfCastHasVideo, getUserFromUsername } from '../utils/farcaster';
import { isOptedOut } from '../utils/local-storage';
import { createUserAndUploadGif, maiiinn } from '../utils/gif';

dotenv.config();
// **** ROUTE IMPORTS ****

console.log('right before setting up the workers')
setupWorkers()

clipQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

const redis = new Redis(REDIS_URL);

redis.ping().then(() => {
  console.log('Successfully connected to Redis');
}).catch((error) => {
  console.error('Failed to connect to Redis:', error);
});

// processData().catch(console.error);

const origin = getPublicUrl();
console.log({ origin });

export const app = new Frog({
  // hub: {
  //   apiUrl: "https://hubs.airstack.xyz",
  //   fetchOptions: {
  //     headers: {
  //       "x-airstack-hubs": AIRSTACK_API_KEY,
  //     }
  //   }
  // },
  assetsPath: '/',
  basePath: '/',
  origin,
  secret: process.env.NODE_ENV === 'production' ? SECRET : undefined,
});

app.use('*', cors({
  origin: ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization', "x-api-key"],
  exposeHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: true,
  maxAge: 600,
}))

app.use(async (c, next) => {
  const fullUrl = c.req.url;
  const [baseUrl, queryString] = fullUrl.split('?');
  
  Logger.info(`[${c.req.method}] ${baseUrl}`);

  await next();
});

app.route('/', landing);

app.route('/vibra', vibraFrame)
app.route('/stream', stream)
app.route('/moxiefolio', moxiefolioFrame)
app.route('/vibratv', vibraTvFrame)


/// LIVESTREAMS ROUTE
app.route('/livestreams', livestreamsRoute)

app.get("/aloja", (c) => {
  return c.json({
    134: 124,
  });
});

app.get("/queue-health", async (c) => {
  try {
    const queueCounts = await clipQueue.getJobCounts();
    
    return c.json({
      jobCounts: queueCounts,
      message: 'Queue is operational'
    });
  } catch (error) {
    console.error("Error checking queue health:", error);
    return c.json({
      isConnected: false,
      error: "Failed to check queue health",
    }, 500);
  }
});

// app.post("/notify-user/:handle", async (c) => {
//   try {
//     console.log('INSIDE THE NOTIFY USER FUNCTION')
//     const { handle } = c.req.param();
//     const body = await c.req.json()
//     console.log("inside the notify user function", handle, body)
//     const { fid } = body.untrustedData;
//     console.log(`the user with ${fid} wants to be notified when ${handle} starts a stream`);
//     return c.json({
//       status: 'success',
//       message: 'The user has been stored to be notified',
//     }, 200);
//   } catch (error) {
//     console.log('there was an error on the notify user function', error)
//     return c.json({
//       status: 'error',
//       message: 'Error processing video',
//       error: error! || 'Unknown error'
//     }, 500);
//   }
// })

app.post("/video-posted", async (c) => {
  try {
    console.log('inside the video posted webhook');
    const body = await c.req.json();
    console.log("IN HERE, THE BODY IS: ", body);

    const { data } = body;
    if (data.object !== 'cast') {
      return c.json({ error: 'Not a cast object' }, 400);
    }

    const castHash = data.hash;
    const fid = data.author.fid;

    if (await isOptedOut(fid)) {
      console.log(`User ${fid} has opted out. Skipping processing.`);
      return c.json({ message: 'User has opted out' }, 200);
    }

    // Fetch cast information
    const cast = await fetchCastInformationFromHash(castHash);
    console.log("the cast is: ", cast);

    // Check if the cast has a video
    const doesCastHaveVideo = checkIfCastHasVideo(cast.embeds[0]?.url);
    console.log("DOES CAST HAVE VIDEO ", doesCastHaveVideo);

    if (doesCastHaveVideo) {
      try {
        console.log('right before sending the video for processing');
        const jobId = await queueCastVideoProcessing(cast, fid);
        console.log("right after processcastvideo function, jobId: ", jobId);

        const publicUrl = getPublicUrl();
        
        // Instead of returning a frame response, we'll return a success message
        return c.json({
          status: 'success',
          message: 'Video queued for processing',
          processingUrl: `${publicUrl}/vibratv/processing-video/${castHash}`,
          jobId
        });
      } catch (error) {
        console.error('Error processing video:', error);
        return c.json({
          status: 'error',
          message: 'Error processing video',
          error: error.message
        }, 500);
      }
    } else {
      return c.json({
        status: 'error',
        message: 'Invalid video or no video found in cast'
      }, 400);
    }
  } catch (error) {
    console.log("there was an error on the video posted webhook", error);
    return c.json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    }, 500);
  }
});

app.get("/moxie-airdrop/:fid", (c) => {
  let { fid } = c.req.param();

  if (!fid || isNaN(Number(fid))) {
    return c.json({ error: "Invalid or missing FID parameter" }, 400);
  }

  const numericFid = Number(fid);
  
  // Deterministic calculation
  const base = 500000; // 500,000 as base
  const prime1 = 31; // A prime number
  const prime2 = 47; // Another prime number
  const maxAirdrop = 2000000; // Cap at 2 million
  
  // Complex calculation to make it non-linear
  let result = base;
  result += (numericFid * prime1) % 10000; // Add some variability based on FID
  result *= Math.floor(Math.sqrt(numericFid) * prime2); // Multiply by a factor based on square root of FID
  result = result % 1999999 + 1; // Ensure result is between 1 and 2 million
  
  // Final adjustment to make it look more random
  result = (result * 1337) % 2000000; // 1237 is another prime

  // Ensure the result doesn't exceed the maximum airdrop amount
  result = Math.min(result, maxAirdrop);

  return c.json({
    fid: numericFid,
    moxieAirdropAmount: result
  });
});

const dummyLivestreamViewers = [
  {
    username: "saynode",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/f80bcc9b-7cb4-4758-7e9b-4b23fd0e6f00/original",
    display_name: "SayNode",
    fid: 486976
  },
  {
    username: "pleb",
    pfp_url: "https://i.imgur.com/u5JyUsu.png",
    display_name: "DRV🎩",
    fid: 16975
  },
  {
    username: "cartoonistsatish",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/7a33cd87-c317-4a64-1392-f65f5137be00/original",
    display_name: "Satish Acharya",
    fid: 406881
  },
  {
    username: "uyo66",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/ddaecdf6-5e75-4611-4ad2-0630735b9900/original",
    display_name: "uyo66 🔥💎🎩",
    fid: 523746
  },
  {
    username: "db3045",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/49a59d05-ac7c-4a6b-f4d3-0b52f78f9b00/original",
    display_name: "DavidBeiner",
    fid: 238853
  },
  {
    username: "leehu23",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/99081801-c661-44ac-ec0a-dff6229f7500/rectcrop3",
    display_name: "Unieeeee 🎭",
    fid: 501701
  },
  {
    username: "lorenipsum",
    pfp_url: "https://i.imgur.com/8xBVkUd.jpg",
    display_name: "lorenipsum 🎩🎭",
    fid: 343039
  },
  {
    username: "dwn2erth.eth",
    pfp_url: "https://ipfs.decentralized-content.com/ipfs/bafybeih6a65qekiszxifbelt2jm46nbwuvgyxscmmlzar7lhmztidjechi",
    display_name: "dwn2erth🎩",
    fid: 288204
  },
  {
    username: "zahedtabnak.eth",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/2bda4ca2-c50b-403e-432c-85901f91b700/rectcrop3",
    display_name: "Zahed🎩🎭",
    fid: 478670
  },
  {
    username: "maie",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/908aca26-ab9b-4cff-200b-f10764734600/original",
    display_name: "Maie 🎩🎭",
    fid: 349816
  },
  {
    username: "degentipbot.eth",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/36ca6aea-b003-4aae-6f26-f2a5165b2000/rectcrop3",
    display_name: "$DEGEN Tip Bot",
    fid: 403507
  },
  {
    username: "archilles",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/ad90fec1-b6d0-4095-62c0-6fc781239e00/rectcrop3",
    display_name: "Archilles 🎩🐹🎭",
    fid: 441632
  },
  {
    username: "marydeer",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/c346e71b-54b5-4eb1-30b2-cfb8b83de200/rectcrop3",
    display_name: "marydeer🌼🎩",
    fid: 380287
  },
  {
    username: "omegas24",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/f8073751-6f7e-4fb4-caac-9e8814814400/rectcrop3",
    display_name: "Imtheone 🎭",
    fid: 684582
  },
  {
    username: "shuk007.eth",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/bc66883b-970a-4c5c-05fe-2cd0767a4e00/original",
    display_name: "Shuk007.eth🎩Ⓜ️🐹🎭",
    fid: 285604
  },
  {
    username: "bella007",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/0714f955-45cf-41f1-8f66-984cbea1af00/rectcrop3",
    display_name: "Itz Bella 🌈⚡🎩🔵",
    fid: 647182
  },
  {
    username: "guillaumecornet",
    pfp_url: "https://i.imgur.com/vHdOEFq.gif",
    display_name: "Guil 🐘 🎩 ✨",
    fid: 364017
  },
  {
    username: "abidur40",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/4b287a10-a161-42d4-534b-008ae8487c00/rectcrop3",
    display_name: "Certified Gorilla 🍖🦖👾",
    fid: 330428
  },
  {
    username: "metadavid",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/fde10191-9f94-426b-730e-4cf31710a400/original",
    display_name: "meta-david🎩 | Building Scoop3",
    fid: 243818
  },
  {
    username: "freymon",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/9840b67b-6667-4b97-0b06-10c98507d300/rectcrop3",
    display_name: "Freymon🎩",
    fid: 665530
  },
  {
    username: "bryhmo",
    pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/eec2e29b-6d90-4fb7-d271-6f7258811100/rectcrop3",
    display_name: "Bryhmo 🐭🎩🍖",
    fid: 511655
  },
  {
    username: "niloofarmd",
    pfp_url: "https://i.imgur.com/qaeXxZ5.jpg",
    display_name: "Niloofar 🪷🎭",
    fid: 482872
  }
];

const getRandomListeners = (num : number) => {
  const shuffled = dummyLivestreamViewers.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
};

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
      fid: farcasterUser?.fid || 16098,
      username: farcasterUser?.username || "jpfraneto",
      craft: farcasterUser?.bio ? extractWordBeforeWaveEmoji(farcasterUser.bio) : "",
      pfp_url: farcasterUser?.pfp || "https://dl.openseauserdata.com/cache/originImage/files/9bb46d16f20ed3d54ae01d1aeac89e23.png"
    };

    const uuid = uuidv4();
    const fileExtension = mime.extension(file.type) || 'mp4';
    const filename = `${uuid}.${fileExtension}`;
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename);
    const farcasterGifPath = path.join(process.cwd(), 'public', 'gifs_farcaster', `${uuid}_farcaster.gif`);
        
    tempFiles = [videoPath, farcasterGifPath];

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

    // Append that gif to the static background and create a new gif (with user information also)
    logProgress('Creating framed GIF...');
    await createFramedGifFromVideo(videoPath, farcasterGifPath, user);
    logProgress('Creating black and white GIF...');

    logProgress('Uploading GIFs to cloud...');
    const cloudinaryGifUploadResult = await uploadGifToTheCloud(farcasterGifPath, `farcaster_gifs/${uuid}`);
    console.log("Colored GIF upload result:", cloudinaryGifUploadResult);

    logProgress('Publishing cast...');
    let castOptions = {
      text: "",
      embeds: [{url: `https://frames.vibra.so/vibra/video/${uuid}`}],
      parent: "0xbc7c9fd8a6278ed1f6f09c4990f42d504ebe17e7",
      signer_uuid: DUMMY_BOT_SIGNER,
    };

    const castResponse = await publishCastToTheProtocol(castOptions, CHISPITA_OXIDA_SIGNER_UUID);

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

    return c.json({ 
      gifLink: cloudinaryGifUploadResult.secure_url,
      castHash: castResponse.hash,
      warpcastLink: `https://warpcast.com/~/conversations/${castResponse.hash}` // Add this line
    });

  } catch (error) {
    console.error("There was an error processing the video", error);
    return c.json({ error: error.message }, 500);
  } finally {
    for (const file of tempFiles) {
      try {
        await fs.access(file);  // Check if file exists before attempting to delete
        await fs.unlink(file);
        console.log(`Deleted temporary file: ${file}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {  // Only log error if it's not a "file not found" error
          console.error(`Failed to delete temporary file ${file}:`, err);
        }
      }
    }
  }
});

app.post('/wc-video', async (c) => {
  const { castHash } = await c.req.json();

  if (!castHash) {
    return c.json({ message: 'Cast hash is required' }, 400);
  }

  try {
    // Fetch cast information from Neynar
    const castInfo = await fetchCastInformationFromHash(castHash);
    const authorFid = castInfo.author.fid;
    // check if the user is on the list of the ones that don't want to be replied to. if so, just console log and return
    if (await isOptedOut(authorFid)) {
      console.log(`User ${authorFid} has opted out. Skipping processing.`);
      return c.json({ message: 'User has opted out' }, 200);
    }

    const videoUrl = castInfo.embeds?.find(embed => isValidVideoUrl(embed.url))?.url;

    if (!videoUrl) {
      return c.json({ message: 'No valid video URL found in the cast' }, 400);
    }

    // Generate unique identifiers for our files
    const uuid = uuidv4();
    const videoPath = path.join(process.cwd(), 'temp', `${uuid}.mp4`);
    await fs.mkdir(path.dirname(videoPath), { recursive: true });

    // Handle HLS streams
    if (isHLSStream(videoUrl)) {
      await downloadHLSStream(videoUrl, videoPath);
    } else {
      // For direct video files, download as before
      const videoResponse = await fetch(videoUrl);
      console.log('after the video response')
      const videoArrayBuffer = await videoResponse.arrayBuffer();
      const videoBuffer = Buffer.from(videoArrayBuffer);
      await fs.writeFile(videoPath, videoBuffer);
    }

    // Process the video and create a GIF
    const gifPath = path.join(process.cwd(), 'temp', `${uuid}.gif`);
    const videoDuration = await getVideoDuration(videoPath);
    console.log('the video duration is: ', videoDuration)
    let gifDuration = Math.min(videoDuration, 30); // Cap at 30 seconds
    let fps = 10;
    let scale = 350;
    let gifSize = Infinity;

    while (gifSize > 10 * 1024 * 1024 && gifDuration > 1) { // 10MB limit
      await createAndSaveLocallyCompressedGifFromVideo(videoPath, gifPath);
      const stats = await fs.stat(gifPath);
      console.log("the stats are: ", stats)
      gifSize = stats.size;

      if (gifSize > 10 * 1024 * 1024) {
        gifDuration = Math.max(gifDuration * 0.9, 1);
        fps = Math.max(fps * 0.9, 5);
        scale = Math.max(Math.floor(scale * 0.9), 160);
      }
    }

    if (gifSize > 10 * 1024 * 1024) {
      throw new Error('Unable to create GIF within size limit');
    }

    // Upload the GIF to Cloudinary
    const cloudinaryResult = await uploadGifToTheCloud(gifPath, `cast_gifs/${uuid}`);
    console.log("the cloudinary result is: ", cloudinaryResult);

    // Upsert to database
    const castWithVideo = await prisma.castWithVideo.upsert({
      where: { castHash },
      update: {
        gifUrl: cloudinaryResult.secure_url,
        videoDuration,
        gifDuration,
        fps,
        scale,
      },
      create: {
        castHash,
        gifUrl: cloudinaryResult.secure_url,
        videoDuration,
        gifDuration,
        fps,
        scale,
      },
    });

    let castOptions = {
      text: "",
      embeds: [{url: `https://frames.vibra.so/vibra/cast-gifs/${uuid}/${castInfo.hash}`}],
      parent: castInfo.hash,
      signer_uuid: CHISPITA_OXIDA_SIGNER_UUID,
    };

    const castingResponse = await publishCastToTheProtocol(castOptions, NEYNAR_DUMMY_BOT_API_KEY);
    console.log("the casting response is: ", castingResponse)
    // Clean up temporary files
    await fs.unlink(videoPath);
    await fs.unlink(gifPath);

    return c.json({ gifUrl: castWithVideo.gifUrl });
  } catch (error) {
    console.error('Error processing cast:', error);
    return c.json({ message: 'Error processing cast', error: error.message }, 500);
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



// async function getChannelsInformation () {
//   try {
//     let thisChannel;
//     let organizedChannels = []
//     const channels = ["replyguys", "superrare", "lp",  "memes", 'farther', 'masks', 'degen', 'itookaphoto', 'base', 'degentokenbase', 'warpcast', 'mfers', 'dev', 'ai', 'video', 'behindthescenes', 'success', 'crypto', 'wildcardclub', 'farcaster', 'cute-animals']
//     for (let channel of channels) {
//       const options = {
//         method: 'GET',
//         url: `https://api.neynar.com/v2/farcaster/channel/search?q=${channel}`,
//         headers: {accept: 'application/json', api_key: NEYNAR_API_KEY}
//       };
//       const response = await axios.request(options)
//       let channeeel = response.data.channels[0]
//       thisChannel = {
//         id: channeeel.id,
//         name: channeeel.name,
//         description: channeeel.description,
//         follower_count: channeeel.follower_count,
//         image_url: channeeel.image_url,
//       }
//       organizedChannels.push(thisChannel)
//     }
//     console.log("the organized channels are:" , organizedChannels)
//   } catch (error) {
    
//   }
// }
// getChannelsInformation()

app.use("/*", serveStatic({ root: "./public" }));
devtools(app, { serveStatic });

const port = process.env.PORT || 3000;
console.log("the port is: ", port)

serve({
  fetch: app.fetch,
  port: Number(port),
})


console.log(`Server is running on port ${port}`)

// async function sendProgramaticDmToSubscribers(subscribers: any) {
//   try {
//     console.log("sending programatic dcs to subscribers: ", subscribers)
//     for (let subscriber of subscribers) {
//       const uuid = uuidv4();
//       const directCastData = {
//         recipientFid: subscriber,
//         message: `${uuid}\n\nwena wena, este DC fue creado programaticamente y basicamente estamos cachando el mote de si funciona o no. Si te llego, porfa mandame un mensaje diciendo que te llego. Gracias! \n\nhttps://www.vibra.so/stream/jpfraneto`,
//         idempotencyKey: uuid
//       };
//       const response = await axios.put('https://api.warpcast.com/v2/ext-send-direct-cast', directCastData, {
//         headers: {
//           'Authorization': `Bearer ${VIBRA_BOT_WARPCAST_API_KEY}`,
//           'Content-Type': 'application/json'
//         }
//       })
//       console.log("the response is: ", response.data)
//       if(response.data.result.success) {
//         console.log("the message was sent successfully to", subscriber)
//       }
//     }
//   } catch (error) {
//     console.log("there was an error sending the cast to the user", error)
    
//   }
// }

//sendProgramaticDmToSubscribers([16098, 18350, 19696, 12785, 198258])
// sendProgramaticDmToSubscribers([16098])

// const usersAloja = ["wake", "0xen", "samuellhuber.eth", "downshift.eth"]
// async function addUsersToDb(users: any){
//   console.log("the users are: ", users)
//   for (let user of users) {
//     console.log("before with the user", user)
//     const cloudinaryurl = await createUserAndUploadGif(user)
//     console.log("the cloudinary url is: ", cloudinaryurl)
//   }
// }

// addUsersToDb(usersAloja)