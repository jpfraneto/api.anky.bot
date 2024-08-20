import { Button, FrameContext, Frog, TextInput } from 'frog';
import { SECRET } from '../../../env/server-env';
import { NEYNAR_API_KEY, VIBRA_LIVESTREAMS_API, VIBRA_LIVESTREAMS_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { z } from 'zod';
import { promisify } from 'util';
import { createUserAndUploadGif, createUserFromFidAndUploadGif, processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { createCanvas } from 'canvas';
import { fileURLToPath } from 'url';
import queryString from 'query-string';
import { createFinalStreamGif, createFirstStreamGif, getLatestClipFromStream, startClipCreationProcess, startClippingProcess, stopClipCreationProcess } from './clips';
import prisma from '../../../utils/prismaClient';
import { checkIfUserSubscribed, getSubscribersOfStreamer, subscribeUserToStreamer, unsubscribeUserFromStreamer } from './subscriptions';
import { apiKeyAuth } from '../../middleware/auth';
import { sendProgrammaticDmToSubscribers } from './farcaster';
import { StreamStatus } from '@prisma/client';


const execAsync = promisify(exec);

const StreamStartedSchema = z.object({
  fid: z.string(),
  nameOfLivestream: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  streamId: z.string().uuid(),
  castHash: z.string(),
  playbackId: z.string(),
});

const StreamEndedSchema = z.object({
  streamId: z.string().uuid(),
  fid: z.string(),
});

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GIF_DIRECTORY = path.join(__dirname, 'generated_gifs');

const imageOptions = {
  width: 600,
  height: 600,
  fonts: [
    {
      name: 'Poetsen One',
      source: 'google',
    },
    {
      name: 'Roboto',
      source: 'google',
    },
  ] as any,
};

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
  imageOptions,
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

app.get("/frame-image/:handle", async (c) => {
  const { handle } = c.req.param();
  try {
    const imageExists = await checkImageExists(`https://res.cloudinary.com/doj6mciwo/image/upload/v1724101804/user_gif_${handle}.gif`)
    let imageUrl = imageExists ? `https://res.cloudinary.com/doj6mciwo/image/upload/v1724101804/user_gif_${handle}.gif` : "https://res.cloudinary.com/doj6mciwo/image/upload/v1723585291/user_gifs/fallback.gif"
    c
    const imageResponse = await fetch(imageUrl)
    const imageArrayBuffer = await imageResponse.arrayBuffer()

    c.header('Content-Type', 'image/gif');
    c.header('Cache-Control', 'max-age=0');
    return c.body(Buffer.from(imageArrayBuffer));
  } catch (error) {
    console.error('Error serving frame image:', error);
    return c.json({ error: 'Error serving frame image' }, 500);
  }
});

app.frame("/", async (c) => {
  return c.res({
    title: "vibra",
    image: "https://github.com/jpfraneto/images/blob/main/start-streaming.png?raw=true",
    intents: [<Button.Link href="https://www.vibra.so">
      Download App
    </Button.Link>],
  });
})


app.frame("/stream-not-found", async (c) => {
  return c.res({
    title: "Error",
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
        <div tw="mb-20 flex text-3xl text-purple-400">
          This stream doesn't exist... /yet/
        </div>
        <div tw="mt-3 flex text-3xl text-white">
         But you can still download and enjoy the app
        </div>
      </div>
    ),
    intents: [
      <Button action={`/download-app/kevinmfer`}>Mobile App</Button>,
    ],
  });
});

app.post("/stream-started", apiKeyAuth, async (c) => {
  console.log("Received request for stream started");

  try {
    const body = await c.req.json();
    console.log("Request body:", body);

    // Validate input
    const validatedData = StreamStartedSchema.parse(body);

    // Check if user exists, if not create user and generate GIF
    let user = await prisma.user.findUnique({ where: { fid: validatedData.fid } });
    console.log("IN HERE, THE USER IS: ", user)
    if (!user) {
      const gifUrl = await createUserFromFidAndUploadGif(validatedData.fid);
      if (!gifUrl) {
        throw new Error("Failed to create user and generate GIF");
      }
      user = await prisma.user.findUnique({ where: { fid: validatedData.fid } });
      if (!user) {
        throw new Error("User creation failed");
      }
    }
    const sanitizedTitle = validatedData.nameOfLivestream.split('-').slice(1).join('-').trim();
    const sanitizedPlaybackId = validatedData.playbackId.split('hls/')[1].split('/index.m3u8')[0];

    // Create or update stream in database
    const stream = await prisma.stream.upsert({
      where: { streamId: validatedData.streamId },
      update: {
        castHash: validatedData.castHash,
        title: sanitizedTitle,
        description: validatedData.description,
        status: StreamStatus.LIVE,
        startedAt: new Date(),
        playbackId: sanitizedPlaybackId,
      },
      create: {
        streamId: validatedData.streamId,
        castHash: validatedData.castHash,
        title: sanitizedTitle,
        description: validatedData.description,
        status: StreamStatus.LIVE,
        startedAt: new Date(),
        playbackId: sanitizedPlaybackId,
        user: {
          connect: { fid: validatedData.fid }
        }
      },
    });
    console.log("THE STREAM WAS JUST CREATED: ", stream)

    // Schedule the creation of the first GIF after 20 seconds
    setTimeout(async () => {
      console.log("NOW THE CREATE FIRST STREAM GIF FUNCTION WILL BE CALLED")
      await createFirstStreamGif(validatedData.streamId, sanitizedPlaybackId, user?.username!);
      console.log("THE CREATE FIRST STREAM GIF THING IS READY")
    }, 20000);

    await startClipCreationProcess(validatedData.streamId, user?.username!);

    const subscribers = await getSubscribersOfStreamer(validatedData.fid);
    console.log(`THe subscribers of the streamer ${validatedData.fid} are: `, subscribers)
   // await sendProgrammaticDmToSubscribers(subscribers, validatedData.fid, sanitizedTitle, validatedData?.description!, validatedData.castHash);
    
    return c.json({ 
      message: `Clipping process started successfully for streamer ${validatedData.fid}, and all the DCs were sent to their subscribers`,
      data: stream
    }, 200);

  } catch (error) {
    console.error("Error handling stream start:", error);

    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }

    if (error.code === 'P2025') {
      return c.json({ error: "Streamer not found" }, 404);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/stream-ended", apiKeyAuth, async (c) => {
  console.log("Received request for stream ended");

  try {
    const body = await c.req.json();
    console.log("Request body:", body);

    // Validate input
    const validatedData = StreamEndedSchema.parse(body);

    // Update stream in database
    const updatedStream = await prisma.stream.update({
      where: { streamId: validatedData.streamId },
      data: {
        status: StreamStatus.ENDED,
        endedAt: new Date(),
      },
      include: { user: true },
    });

    if (!updatedStream) {
      return c.json({ error: "Stream not found" }, 404);
    }

    console.log("Stream updated:", updatedStream);

    // Stop the clip creation process
    await stopClipCreationProcess(validatedData.streamId);

    // Create a final stream GIF (optional)
    await createFinalStreamGif(validatedData.streamId, updatedStream.playbackId!, updatedStream.user.username!);

    return c.json({ 
      message: `Stream ${validatedData.streamId} has been marked as ended`,
      data: updatedStream
    }, 200);

  } catch (error) {
    console.error("Error handling stream end:", error);

    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/generate-gif/:streamer", apiKeyAuth, async (c) => {
  console.log("IIIIIN HERE")
  const { streamer } = c.req.param();
  try {
    return c.json({ message: `received the message to create the account of ${streamer}` });
  } catch (error) {
    return c.json({ message: `there was an error with the streamer` });
  }
});

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Error checking image existence:", error);
    return false;
  }
}

app.get("/frame-image/:handle", async (c) => {
  const { handle } = c.req.param();
  console.log(`Received request for handle: ${handle}`);
  let imageUrl = `https://res.cloudinary.com/doj6mciwo/image/upload/v1723573307/user_gifs/user_gif_${handle}.gif`
  const imageExists = checkImageExists(imageUrl)
  
  if(!imageExists) {
     createUserAndUploadGif(handle)
     imageUrl = "https://res.cloudinary.com/doj6mciwo/image/upload/v1723573307/user_gifs/fallback.gif"
  }

  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`Successfully fetched and processed GIF for ${handle}`);
  c.header('Content-Type', 'image/gif');
  c.header('Cache-Control', 'max-age=0');
  return c.body(buffer);
});

app.frame("/:streamer", async (c) => {
  const { streamer } = c.req.param();
  const { root } = c.req.query()

  const userFid = c.frameData?.fid;

  // Find the user first
  const user = await prisma.user.findUnique({
    where: { username: streamer },
    include: {
      streams: {
        orderBy: { createdAt: 'desc' },
        take: 10,  // Fetch the last 10 streams to ensure we have recent data
        include: {
          clips: {
            orderBy: { clipIndex: 'desc' },
            take: 8
          }
        }
      }
    }
  });

  if (!user) {
    const qs = {
      text: `hey @${streamer}, i want to see you streaming on /vibra!`,
      'embeds[]': [
        `https://frames.vibra.so/livestreams`,
      ],
    };
  
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            User not found
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            Time to invite @{streamer} to start streaming on /vibra!
          </div>
        </div>
      ),
      intents: [
        <Button.Link href={warpcastRedirectLink}>Invite @{streamer}</Button.Link>,
      ],
    });
  }

  let relevantStream = user.streams[0]; 

  const response = await axios.get(
    `${VIBRA_LIVESTREAMS_API}/livestreams/info?handle=${streamer}`,
    {
      headers: {
        "api-key": VIBRA_LIVESTREAMS_API_KEY!,
        "User-Agent": `vibra-web-development`,
      },
    }
  );
  const streamData = response.data;

  if (streamData && streamData.livepeerInfo && streamData.livepeerInfo.streamId) {
    const liveStream = user.streams.find(stream => stream.streamId === streamData.livepeerInfo.streamId);
    if (liveStream) {
      relevantStream = liveStream;
    }
  }

  let streamId = relevantStream?.streamId || streamData?.livepeerInfo?.streamId;

  console.log('THE STREAM DATA HERE IS:', streamData, 'AND THE STREAM ID:', streamId)
  console.log('THE USERSSS ARE', streamer, userFid)
  console.log("THE RELEVANT STREAM IS: ", relevantStream)
  const isStreamLive = streamData?.status == "live";
  console.log("The stream is live:", isStreamLive);

  const isUserSubscribed = await checkIfUserSubscribed(streamer, userFid!);
  console.log("Is user subscribed:", isUserSubscribed);

  // Rest of your code remains the same, but use latestStream instead of thisStream
  if (isStreamLive) {
    console.log('THE STREAM IS LIVE');
    const latestProcessedClipInfo = await getLatestClipFromStream(relevantStream, streamer);
  
      console.log("The latest clip info is: ", latestProcessedClipInfo)
      
      if (!latestProcessedClipInfo) {
        return c.res({
          title: "vibra",
          image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
              <div tw="mb-20 flex text-3xl text-purple-400">
                Error fetching stream data
              </div>
              <div tw="mt-3 flex text-3xl text-white">
                Please try again later
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}?streamId=${streamId}`}>Retry</Button>,
          ],
        });
      }
      
      if (!latestProcessedClipInfo.hasClips) {
        return c.res({
          title: "vibra",
          image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
              <div tw="mb-20 flex text-5xl text-purple-400">
                @{streamer} is live!
              </div>
              <div tw="mt-3 flex text-5xl text-white">
                We are processing the stream and creating the first clip...
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            <Button action={`/${streamer}?root=true&streamId=${streamId}`}>Refresh</Button>,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
          ],
        });
      }

      if (latestProcessedClipInfo.isProcessing) {
        return c.res({
          title: "vibra",
          image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
              <div tw="mb-20 flex text-5xl text-purple-400">
                @{streamer} is live!
              </div>
              <div tw="mt-3 flex text-5xl text-white">
                The first clip is being created...
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            <Button action={`/${streamer}?root=true&streamId=${streamId}`}>Refresh</Button>,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
          ],
        });
      }

      if (latestProcessedClipInfo.hasClips && !latestProcessedClipInfo.isProcessing) {
        const totalClips = relevantStream.clips.length;
        const currentPosition = totalClips; // Because this is the latest clip
    
        const navigationButton = totalClips > 1 
          ? <Button action={`/clips/${streamer}/${streamId}/${latestProcessedClipInfo.index}`}>
              {(totalClips - 1).toString()}/{totalClips.toString()} ▶️
            </Button>
          : null;
    
        return c.res({
          title: "vibra",
          image: latestProcessedClipInfo.gifUrl,
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            navigationButton,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
          ],
        });
      }

      return c.res({
        title: "vibra",
        image: latestProcessedClipInfo.gifUrl,
        intents: [
          <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
            {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
          </Button>,
          <Button action={`/clips/${streamer}/${streamId}/${latestProcessedClipInfo.index}`}>▶️</Button>,
          <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
        ],
      });
    } else {
      return c.res({
        title: "vibra",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-4xl text-purple-400">
              @{streamer} is not live anymore
            </div>
            <div tw="mt-3 flex text-4xl text-white">
              {isUserSubscribed ? "You will be notified when they go live again" : "Subscribe to get notified when they go live again"}
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
            {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
          </Button>,
          <Button action={`/watch-clips/${streamer}/${streamId}/0`}>View Clips</Button>,
        ],
      });
    }
});


app.frame("/:streamer/subscribe", async (c) => {
  const { streamer } = c.req.param();
  const userFid = c.frameData?.fid;

  if (!userFid) {
    return c.res({
      title: "Error",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            Unable to identify user
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            Please try again or contact support
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back</Button>,
      ],
    });
  }

  const response = await subscribeUserToStreamer(streamer, userFid);
  if (response.success) {
    const qs = {
      text: `i just subscribed to @${streamer} on /vibra and will be notified when a livestream starts.\n\ndo the same here:`,
      'embeds[]': [
        `https://www.vibra.so/stream/${streamer}`,
      ],
    };
  
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            You subscribed to @{streamer}
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            You will receive a DM from @vibrabot.eth when they go live.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}/unsubscribe`}>Unsubscribe</Button>,
        <Button.Link href={`https://www.warpcast.com/vibraso.eth`}>FollowVibraBot</Button.Link>,
        <Button.Link href={warpcastRedirectLink}>Share</Button.Link>,
      ],
    });
  } else {
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            There was an error subscribing you to this user
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            Please try again or contact support if the issue persists.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Stream</Button>,
        <Button.Link href={`https://www.warpcast.com/jpfraneto`}>Contact Support</Button.Link>,
      ],
    });
  }
});

app.frame("/:streamer/unsubscribe", async (c) => {
  const { streamer } = c.req.param();
  const userFid = c.frameData?.fid;

  if (!userFid) {
    return c.res({
      title: "Error",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            Unable to identify user
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            Please try again or contact support
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Stream</Button>,
      ],
    });
  }

  const response = await unsubscribeUserFromStreamer(streamer, userFid);
  if (response.success) {
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            You unsubscribed from @{streamer}
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            You will no longer receive notifications when they go live.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}/subscribe`}>Subscribe</Button>,
        // <Button action={`/${streamer}?root=true`}>@{streamer}</Button>,
        <Button.Link href={`https://www.warpcast.com/${streamer}`}>@{streamer}</Button.Link>,
      ],
    });
  } else {
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            There was an error unsubscribing you from this user
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            Please try again or contact support if the issue persists.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Stream</Button>,
        <Button.Link href={`https://www.warpcast.com/jpfraneto`}>Contact Support</Button.Link>,
      ],
    });
  }
});

app.frame("/download-app/:streamer", async (c) => {
  const { streamer } = c.req.param();
  
  return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/vibra-square.png?raw=true",
      intents: [
        //  <Button action={`/${streamer}`}>Watch Stream</Button>,
         <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
         <Button.Link href="https://www.vibra.so/android">android</Button.Link>
        ],
  })
})

app.frame("/clips/:streamer/:streamId/:index", async (c) => {
  const { streamer, streamId, index } = c.req.param();
  const clipIndex = parseInt(index);
  const userFid = c.frameData?.fid;
  let streamerPfp = "";
  console.log(`Fetching clip ${clipIndex} for streamer: ${streamer}, stream: ${streamId}`);
  let isUserSubscribed = false
  if(userFid) {
    isUserSubscribed = await checkIfUserSubscribed(streamer, userFid!);
  }
  try {
    const stream = await prisma.stream.findUnique({
      where: { streamId: streamId },
      include: {
        clips: {
          orderBy: { clipIndex: 'desc' },
        }
      }
    });

    if (!stream) {
      return c.res({
        title: "Vibra - Stream Not Found",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-3xl text-purple-400">
              Stream not found
            </div>
            <div tw="mt-3 flex text-3xl text-white">
              This stream doesn't exist or has been deleted.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}`}>Back</Button>,
        ],
      });
    }

    const clips = stream.clips;
    const clip = clips.find(c => c.clipIndex === clipIndex);

    if (!clip) {
      return c.res({
        title: "Vibra - Clip Not Found",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-3xl text-purple-400">
              Clip not found
            </div>
            <div tw="mt-3 flex text-3xl text-white">
              This clip doesn't exist or hasn't been processed yet.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}`}>Back to Stream</Button>,
        ],
      });
    }

    const currentClipIndex = clips.findIndex(c => c.clipIndex === clipIndex);
    const prevClip = clips[currentClipIndex + 1];
    const nextClip = clips[currentClipIndex - 1];
    
    // Calculate the current position and total number of clips
    const currentPosition = currentClipIndex + 1;
    const totalClips = clips.length;

    const qs = {
      text: `check out this clip from @${streamer} on /vibra, part of their stream:\n\n"${stream.title}"\n\nwatch the stream LIVE here:`,
      'embeds[]': [
        `https://frames.vibra.so/livestreams/${streamer}/${streamId}/${index}`,
      ],
    };
  
    const shareQs = queryString.stringify(qs);
    const thisFrameClipUrl = `https://warpcast.com/~/compose?${shareQs}`;

    return c.res({
      title: `Vibra - ${streamer}'s Clip`,
      image: clip.cloudinaryUrl,
      intents: [
        prevClip 
          ? <Button action={`/clips/${streamer}/${streamId}/${prevClip.clipIndex}`}>
              ◀️ {currentPosition + 1}/{totalClips}
            </Button> 
          : null,
        nextClip 
          ? <Button action={`/clips/${streamer}/${streamId}/${nextClip.clipIndex}`}>
              {currentPosition - 1}/{totalClips} ▶️
            </Button> 
          : null,
        stream.status === 'LIVE' 
          ? <Button.Link href={`https://www.vibra.so/stream/${streamer}?profilePicture=${streamerPfp}`}>
              Live 📺
            </Button.Link>
          : <Button action={`/${streamer}`}>WatchStream</Button>,
        <Button.Link href={thisFrameClipUrl}>Share</Button.Link>,
        ],
    });
  } catch (error) {
    console.error("Error fetching clip:", error);
    return c.res({
      title: "Vibra - Error",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            Error fetching clip
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            An error occurred while fetching the clip. Please try again later.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Stream</Button>,
      ],
    });
  }
});

app.frame("/watch-clips/:streamer/:streamId/:index", async (c) => {
  const { streamer, streamId, index } = c.req.param();
  const clipIndex = parseInt(index);
  console.log(`Fetching clip ${clipIndex} for streamer: ${streamer}, stream: ${streamId}`);
  let isUserSubscribed = false
  const userFid = c.frameData?.fid;
  if(userFid) {
    isUserSubscribed = await checkIfUserSubscribed(streamer, userFid!);
  }

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
    console.log('inside the watch clips route', stream);

    if (!stream) {
      return c.res({
        title: "Vibra - Stream Not Found",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-3xl text-purple-400">
              Stream not found
            </div>
            <div tw="mt-3 flex text-3xl text-white">
              This stream doesn't exist or has been deleted.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}`}>Back to Streamer</Button>,
        ],
      });
    }

    const clips = stream.clips;
    
    if (clips.length === 0) {
      return c.res({
        title: "Vibra",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-3xl text-purple-400">
              No clips available
            </div>
            <div tw="mt-3 flex text-3xl text-white">
              This stream doesn't have any clips yet.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}`}>Back to Streamer</Button>,
        ],
      });
    }

    const currentClipIndex = clipIndex < clips.length ? clipIndex : 0;
    const clip = clips[currentClipIndex];

    if (!clip) {
      return c.res({
        title: "Vibra - Clip Not Found",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-3xl text-purple-400">
              Clip not found
            </div>
            <div tw="mt-3 flex text-3xl text-white">
              This clip doesn't exist or has been deleted.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}`}>Back to Streamer</Button>,
        ],
      });
    }

    const prevClip = clips[currentClipIndex + 1];
    const nextClip = clips[currentClipIndex - 1];
    
    // Calculate the current position and total number of clips
    const currentPosition = clips.length - currentClipIndex;
    const totalClips = clips.length;

    let imageContent;
    if (clip.cloudinaryUrl) {
      imageContent = clip.cloudinaryUrl;
    } else {
      imageContent = (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            Clip Processing
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            This clip is still being processed. Please check back later.
          </div>
        </div>
      );
    }
    const qs = {
      text: `check out this clip from @${streamer} on /vibra, part of their stream:\n\n"${stream.title}"\n\nwatch more clips of the stream (or subscribe to be notified when they go live again) here:`,
      'embeds[]': [
        `https://frames.vibra.so/livestreams/watch-clips/${streamer}/${streamId}/${index}`,
      ],
    };
  
    const shareQs = queryString.stringify(qs);
    const thisFrameClipUrl = `https://warpcast.com/~/compose?${shareQs}`;
    return c.res({
      title: `Vibra - ${streamer}'s Clip`,
      image: imageContent,
      intents: [
        prevClip 
          ? <Button action={`/watch-clips/${streamer}/${streamId}/${currentClipIndex + 1}`}>
              ◀️ ({(currentPosition - 1).toString()}/{totalClips.toString()})
            </Button> 
          : null,
        nextClip 
          ? <Button action={`/watch-clips/${streamer}/${streamId}/${currentClipIndex - 1}`}>
              ({(currentPosition + 1).toString()}/{totalClips.toString()}) ▶️
            </Button> 
          : null,
         <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
          {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
        </Button>,,
        <Button.Link href={thisFrameClipUrl}>Share 📎</Button.Link>,
      ],
    });
  } catch (error) {
    console.error("Error fetching clip:", error);
    return c.res({
      title: "Vibra - Error",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-3xl text-purple-400">
            Error fetching clip
          </div>
          <div tw="mt-3 flex text-3xl text-white">
            An error occurred while fetching the clip. Please try again later.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Streamer</Button>,
      ],
    });
  }
});


app.get("/static/create-stream", async (c) => {
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

    console.log(`Stream created successfully. Stream ID: ${stream?.id}, Playback ID: ${stream?.playbackId}`);

    console.log('Starting the clipping process...');
    startClippingProcess(stream?.playbackId!, stream?.id!, "jpfraneto");

    console.log('Sending response to client.');
    return c.json({
      success: true,
      streamId: stream?.id,
      playbackId: stream?.playbackId,
    });
  } catch (error) {
    console.error("Error creating stream:", error);
    return c.json({
      success: false,
      error: "Failed to create stream",
    });
  }
});

