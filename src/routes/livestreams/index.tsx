import { Button, FrameContext, Frog, TextInput } from 'frog';
import { SECRET } from '../../../env/server-env';
import { NEYNAR_API_KEY, VIBRA_LIVESTREAMS_API, VIBRA_LIVESTREAMS_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { z } from 'zod';
import { promisify } from 'util';
import { createUserFromFidAndUploadGif, processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { fileURLToPath } from 'url';
import queryString from 'query-string';
import { getLatestClipFromStream, startClipCreationProcess, startClippingProcess } from './clips';
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

    await startClipCreationProcess(validatedData.streamId);

    const subscribers = await getSubscribersOfStreamer(validatedData.fid);
    console.log(`THe subscribers of the streamer ${validatedData.fid} are: `, subscribers)
    await sendProgrammaticDmToSubscribers(subscribers, validatedData.fid, sanitizedTitle, validatedData?.description!, validatedData.castHash);
    
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

app.get("/generate-gif/:streamer", apiKeyAuth, async (c) => {
  console.log("IIIIIN HERE")
  const { streamer } = c.req.param();
  try {
    return c.json({ message: `received the message to create the account of ${streamer}` });
  } catch (error) {
    return c.json({ message: `there was an error with the streamer` });
  }
});

app.get("/frame-image/:streamer", async (c) => {
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
  const { streamer } = c.req.param();
  const { root } = c.req.query()

  const buttonIndex = c?.frameData?.buttonIndex;
  const userFid = c.frameData?.fid;
  console.log("THE FRAME DATA OS: ", c.frameData)

  if (buttonIndex == 1 || root) {
    const streams = await prisma.stream.findMany({
      where: {
        castHash: c?.frameData?.castId.hash
      },
      include: {
        clips: {
          orderBy: { clipIndex: 'desc' },
          take: 8
        }
      }
    })
    const thisStream = streams[0]
    const streamId = thisStream.streamId
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
    const isStreamLive = streamData?.status == "live";
    console.log("The stream is live:", isStreamLive);

    const isUserSubscribed = await checkIfUserSubscribed(streamer, userFid!);
    console.log("Is user subscribed:", isUserSubscribed);

    if (isStreamLive) {
      console.log('THE STREAM IS LIVE');
      const latestProcessedClipInfo = await getLatestClipFromStream(thisStream, streamer);
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
                Be the first to create a clip!
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            <Button action={`/create-first-clip/${streamer}/${streamId}`}>🎬</Button>,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
            <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
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
                Clip #{latestProcessedClipInfo.index} is being created...
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            <Button action={`/${streamer}?root=true&streamId=${streamId}`}>Refresh</Button>,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
            <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
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
          <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
        ],
      });
    } else {
      console.log("THE STREAMER IS NOT LIVE ANYMORE");
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
          // <Button action={`/clips/${streamer}`}>View Clips</Button>,
          <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
        ],
      });
    }
  } else {
    console.log("inside the button index 2");
    return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/vibra-square.png?raw=true",
      intents: [
        // <Button action={`/${streamer}`}>Watch Stream</Button>,
        <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
        <Button.Link href="https://www.vibra.so/android">Android</Button.Link>,
      ],
    });
  }
});

app.frame("/create-first-clip/:streamer/:streamId", async (c) => {
  const { streamer, streamId } = c.req.param();
  const streamerPfp = ""
  
  try {
    // Check if a clip is already being processed
    const existingClip = await prisma.clip.findFirst({
      where: {
        streamId: streamId,
        status: 'PROCESSING'
      }
    });

    if (existingClip) {
      // A clip is already being processed, show the waiting screen
      return c.res({
        title: "vibra - Clip in Progress",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-5xl text-purple-400">
              Clip is being created...
            </div>
            <div tw="mt-3 flex text-4xl text-white">
              This may take a few minutes.
            </div>
          </div>
        ),
        intents: [
          <Button action={`/create-first-clip/${streamer}/${streamId}`}>Refresh</Button>,
          <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
          <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
        ],
      });
    }

    // Start the clip creation process
    startClipCreationProcess(streamId);

    // Show the initial creation message
    return c.res({
      title: "vibra - Creating Clip",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-5xl text-purple-400">
            Creating first clip...
          </div>
          <div tw="mt-3 flex text-4xl text-white">
            This may take a few minutes.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/create-first-clip/${streamer}/${streamId}`}>Refresh</Button>,
        <Button.Link href={`https://www.vibra.so/stream/${streamer}?profilePicture=${streamerPfp}`}>Live 📺</Button.Link>,
        <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
      ],
    });
  } catch (error) {
    console.error("Error creating first clip:", error);
    return c.res({
      title: "vibra - Error",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-5xl text-purple-400">
            Error creating clip
          </div>
          <div tw="mt-3 flex text-4xl text-white">
            Please try again later.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}`}>Back to Stream</Button>,
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
        <Button action={`/${streamer}`}>Back to Stream</Button>,
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
            You will receive a DM from @vibraso.eth when they go live.
          </div>
        </div>
      ),
      intents: [
        <Button action={`/${streamer}/unsubscribe`}>Unsubscribe</Button>,
        <Button.Link href={`https://www.warpcast.com/vibraso.eth`}>Follow Vibra</Button.Link>,
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
  let streamerPfp = "";
  console.log(`Fetching clip ${clipIndex} for streamer: ${streamer}, stream: ${streamId}`);

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

    const clip = stream.clips.find(c => c.clipIndex === clipIndex);

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
          <Button action={`/clips/${streamer}/${streamId}/${clipIndex - 1}`}>Previous Clip</Button>,
          <Button action={`/${streamer}`}>Back to Stream</Button>,
        ],
      });
    }

    const clips = stream.clips;
    const currentClipIndex = clips.findIndex(c => c.clipIndex === clipIndex);
    const prevClip = clips[currentClipIndex + 1];
    const nextClip = clips[currentClipIndex - 1];

    return c.res({
      title: `Vibra - ${streamer}'s Clip`,
      image: clip.cloudinaryUrl,
      intents: [
        prevClip ? <Button action={`/clips/${streamer}/${streamId}/${prevClip.clipIndex}`}>◀️</Button> : null,
        nextClip ? <Button action={`/clips/${streamer}/${streamId}/${nextClip.clipIndex}`}>▶️</Button> : null,
        stream.status === 'LIVE' 
          ? <Button.Link href={`https://www.vibra.so/stream/${streamer}?profilePicture=${streamerPfp}`}>Live 📺</Button.Link>
          : <Button action={`/${streamer}`}>View Stream</Button>,
        <Button action={`/download-app/${streamer}`}>Mobile App</Button>
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
    startClippingProcess(stream?.playbackId!, stream?.id!);

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

