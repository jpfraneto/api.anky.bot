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
import {  processClipJob } from './routes/livestreams/clips';

//maiiinn("https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_gif,w_112,h_112/https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/11e5479f-e479-4ba0-2221-97a086f65b00/original", "jpfraneto", "output_gif.gif")

// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { tvFrame as stream } from './routes/stream'
import { vibraFrame } from './routes/vibra'
import { moxiefolioFrame } from './routes/moxiefolio';
import { vibraTvFrame } from './routes/vibratv';
import { successFrame } from './routes/success';
import { Redis } from 'ioredis';
import { processData } from '../utils/moxie';
import { checkIfCastHasVideo, getUserFromFid, getUserFromUsername } from '../utils/farcaster';
import { isOptedOut } from '../utils/local-storage';
import { createUserAndUploadGif, maiiinn } from '../utils/gif';
import vibraNamesFrame from './routes/vibranames';

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
  origin: ['http://localhost:3000', 'https://vibra.so', 'https://www.vibra.so', ' https://development-farcaster-api-claucondor-fietbrotma-uc.a.run.app', 'https://poiesis.anky.bot'],
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
app.route('/success', successFrame)
app.route('/vibraname', vibraNamesFrame)

// API ROUTES 


/// LIVESTREAMS ROUTE


app.get("/aloja", (c) => {
  return c.json({
    134: 124,
  });
});

app.get("popular-channels", async (c) => {
  try {
    console.log("getting the popular channels");
  const allChannels = [
     {
      externalId: "vibra",
      name: "Vibra",
      description: "Life Farcaster",
      follower_count: 42951,
      image_url: "https://i.imgur.com/vC00Vn0.png",
    },
    {
      externalId: "thegenradio",
      name: "The Gen Radio",
      description: "The Gen Radio aims to be an open source platform that fosters curatory of content as a vehicle for finding meaning on a hyper content-ized world. Reach out and help shape this thing together.",
      follower_count: 33,
      image_url: "https://i.imgur.com/u7bjhOG.jpg",
    },
    {
      externalId: "anky",
      name: "Anky",
      description: "Anky is a gamified approach to the process of self inquiry, with a simple and core practice: Write, every day, 8 minutes of a stream of consciousness. We will do the rest. anky.bot",
      follower_count: 716,
      image_url: "https://i.imgur.com/rIZeLPf.jpg",
    },

    {
      externalId: "lp",
      name: "HAM 🍖",
      description:
        "The home of $TN100x, Based LP NFTs, and HAM. Snapshots of top casts taken daily. Quality content earns points toward $TN100x airdrop. Tip Ham 🍖 backed by $TN100x. https://ham.fun",
      follower_count: 42951,
      image_url: "https://i.imgur.com/vC00Vn0.png",
    },
    {
      externalId: "memes",
      name: "Memes",
      description:
        "Funny memes, wholesome memes, and everything in-between. subscribe to earn (~$1/mo) https://hypersub.withfabric.xyz/collection/memes-1x0fzjq6ytfy8",
      follower_count: 346516,
      image_url:
        "https://i.seadn.io/gcs/files/1f4acfc1e6831eb38e9453ce34ac79f8.png?auto=format&dpr=1&w=512",
    },
    {
      externalId: "farther",
      name: "F A R T H E R ✨",
      description:
        "Spreading the good news of Farcaster.  farther.social | \n" +
        "\n" +
        "Must have 2,500 $farther to post in the channel",
      follower_count: 9572,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/48b29402-9a95-4463-cdb7-5b6f87e17000/original",
    },
    {
      externalId: "masks",
      name: "$MASKS",
      description:
        "Tokenize Your Engagement • The first social token on Optimism • masks.wtf",
      follower_count: 39387,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/6357ae40-9baf-4f8d-0569-86d783132e00/rectcrop3",
    },
    {
      externalId: "degen",
      name: "Degen",
      description: "Not financial advice",
      follower_count: 93673,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/4728a50a-1669-4334-1f57-9473c04a2500/original",
    },
    {
      externalId: "itookaphoto",
      name: "I Took a Photo!",
      description: `Photography is the world's most popular art form. ITAP is a place to share photos YOU took. Start casts with "ITAP” or “I took a photo” and a short description. Like, reply and recast your faves. Cast your shot!`,
      follower_count: 10685,
      image_url: "https://i.imgur.com/xFQSwGt.jpg",
    },
    {
      externalId: "base",
      name: "Base",
      description: "Bringing the world onchain — a community of builders on Base",
      follower_count: 380971,
      image_url: "https://warpcast.com/~/channel-images/base.png",
    },
    {
      externalId: "degentokenbase",
      name: "$DEGEN",
      description:
        "Welcome to the official $DEGEN channel! Chat about all things $DEGEN. Meet our team:  (CEO) &  (COO) of Gentleman Labs.",
      follower_count: 17027,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/8c956aaf-d633-4544-42bd-9ab938854600/original",
    },
    {
      externalId: "warpcast",
      name: "Warpcast",
      description:
        "Announcements, questions, feedback and suggestions about Warpcast",
      follower_count: 49868,
      image_url:
        "https://ipfs.decentralized-content.com/ipfs/bafkreifezhnp5wzgabkdbkb6d65oix4r5axibupv45r7ifxphl4d6qqnry",
    },
    {
      externalId: "mfers",
      name: "mfers",
      description: "channel for crypto mfers",
      follower_count: 21163,
      image_url: "https://i.imgur.com/huKofm1.jpg",
    },
    {
      externalId: "dev",
      name: "dev",
      description: "Cultivating curiosity for software developers",
      follower_count: 140911,
      image_url:
        "https://ipfs.decentralized-content.com/ipfs/bafkreigbei45ni5zsliszzeivotgee5auj2ykkh6zrzjwvm4izviidusny",
    },
    {
      externalId: "ai",
      name: "AI",
      description: "attention is all you need",
      follower_count: 11751,
      image_url: "https://i.imgur.com/z4yori9.jpg",
    },
    {
      externalId: "video",
      name: "video",
      description: "",
      follower_count: 2073,
      image_url: "https://i.imgur.com/7OYFo3c.jpg",
    },
    {
      externalId: "behindthescenes",
      name: "Behind the Scenes",
      description:
        "Documenting the creative process! Making of videos, process gifs, and behind-the-scenes content. Please read the norms 🎬",
      follower_count: 3814,
      image_url: "https://i.imgur.com/w9imTFl.gif",
    },
    {
      externalId: "success",
      name: "The Success Syndicate",
      description:
        "Home to the Success Movement, a community for networking, building, and growing the Farcaster ecosystem. Subscribe here to cast in this channel: https://hypersub.withfabric.xyz/collection/success",
      follower_count: 2790,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/0b056af5-0144-409a-932d-e43c92f94800/original",
    },
    {
      externalId: "crypto",
      name: "crypto",
      description:
        "Discussions about crypto generally, from its use and tech to its culture and philosophy. Spammy talk about price, charts, gambling, etc. will be hidden or banned. See norms.",
      follower_count: 9717,
      image_url: "https://i.imgur.com/cXa9fjz.png",
    },
    {
      externalId: "wildcardclub",
      name: "wildcard",
      description: "Wildcard is Farcaster gone WILD. \nGo $WILD @ wildcard.lol",
      follower_count: 11782,
      image_url:
        "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/68657e2d-ded8-4bd2-bca2-03779668ac00/original",
    },
    {
      externalId: "farcaster",
      name: "Farcaster",
      description: "Discussions about Farcaster on Farcaster (meta!)",
      follower_count: 315348,
      image_url:
        "https://ipfs.decentralized-content.com/ipfs/bafkreialf5usxssf2eu3e5ct37zzdd553d7lg7oywvdszmrg5p2zpkta7u",
    },
    {
      externalId: "cute-animals",
      name: "Cute Animals",
      description: "Exclusively the cutest animals on the internet.",
      follower_count: 970,
      image_url: "https://i.imgur.com/IN89yCh.png",
    },
  ];
  return c.json({channels: allChannels.slice(0,8)});
  } catch (error) {
    console.log("there was an error getting the popular channels", error);
    return c.json({error: error}, 500);
  }
})

app.get("/recent-livestreams", async (c) => {
  try {
    const livestreams = await prisma.stream.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fid: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          }
        },
        clips: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            gifUrl: true,
            cloudinaryUrl: true,
            clipIndex: true,
            status: true,
          }
        }
      }
    });
    console.log("LIVESTREAMS: ", livestreams);

    const formattedLivestreams = livestreams.map(stream => ({
      id: stream.streamId,
      createdAt: stream.createdAt,
      updatedAt: stream.updatedAt,
      castHash: stream.castHash,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
      title: stream.title,
      description: stream.description,
      status: stream.status,
      playbackId: stream.playbackId,
      clipCreationIntervalId: stream.clipCreationIntervalId,
      firstClipGifUrl: stream.firstClipGifUrl,
      user: stream.user,
      clips: stream.clips,
    }));

    return c.json(formattedLivestreams);
  } catch (error) {
    console.error('Error fetching recent livestreams:', error);
    return c.json({ error: 'Failed to fetch recent livestreams' }, 500);
  }
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

app.get('/init-calendar', async (c) => {
  try {
    const existingSlots = await prisma.calendarSlot.count();
    if (existingSlots === 0) {
      const slots = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          for (let minute of [0, 30]) {
            const index = day * 48 + hour * 2 + (minute === 30 ? 1 : 0);
            slots.push({
              dayOfWeek: day,
              startHour: hour,
              startMinute: minute,
              index,
            });
          }
        }
      }
      await prisma.calendarSlot.createMany({ data: slots });
    }
    return c.json({ message: 'Calendar initialized' });
  } catch (error) {
    console.error('Error initializing calendar:', error);
    return c.json({ error: 'Failed to initialize calendar' }, 500);
  }
});

// Get all calendar slots
app.get('/calendar-slots', async (c) => {
  try {
    const slots = await prisma.calendarSlot.findMany({
      include: { owner: true },
      orderBy: { index: 'asc' },
    });
    return c.json(slots);
  } catch (error) {
    console.error('Error fetching calendar slots:', error);
    return c.json({ error: 'Failed to fetch calendar slots' }, 500);
  }
});

// Mint a calendar slot
app.post('/mint-slot', async (c) => {
  const { userId, slotIndex } = await c.req.json();
  try {
    const updatedSlot = await prisma.calendarSlot.update({
      where: { index: slotIndex },
      data: { ownerId: userId },
    });
    return c.json(updatedSlot);
  } catch (error) {
    console.error('Error minting slot:', error);
    return c.json({ error: 'Failed to mint slot' }, 500);
  }
});

// Get dummy users
app.get('/dummy-users', async (c) => {
  try {
    const dummyUsersPath = path.join(process.cwd(), 'utils', 'dummy_users.json');
    const dummyUsersData = await fs.readFile(dummyUsersPath, 'utf-8');
    const dummyUsers = JSON.parse(dummyUsersData);
    return c.json(dummyUsers);
  } catch (error) {
    console.error('Error fetching dummy users:', error);
    return c.json({ error: 'Failed to fetch dummy users' }, 500);
  }
});

app.get('/fetch-past-livestreams', async (c) => {
  try {
    const livestreams = await prisma.livestream.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return c.json(livestreams);
  } catch (error) {
    console.error('Error fetching past livestreams:', error);
    return c.json({ error: 'Failed to fetch past livestreams' }, 500);
  }
});

app.use("/*", serveStatic({ root: "./public" }));
devtools(app, { serveStatic });

const port = process.env.PORT || 3000;
console.log("the port is: ", port)

serve({
  fetch: app.fetch,
  port: Number(port),
})


console.log(`Server is running on port ${port}`)

