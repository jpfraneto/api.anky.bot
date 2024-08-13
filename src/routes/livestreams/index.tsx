import { Button, FrameContext, Frog, TextInput } from 'frog';
import { SECRET } from '../../../env/server-env';
import { NEYNAR_API_KEY, VIBRA_LIVESTREAMS_API, VIBRA_LIVESTREAMS_API_KEY } from '../../../env/server-env';
import { Livepeer } from "livepeer";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { processAndSaveGif } from '../../../utils/gif';
import axios from 'axios';
import { fileURLToPath } from 'url';
import queryString from 'query-string';
import { getLatestClipFromStream, startClippingProcess } from './clips';
import prisma from '../../../utils/prismaClient';
import { checkIfUserSubscribed, subscribeUserToStreamer, unsubscribeUserFromStreamer } from './subscriptions';
import { apiKeyAuth } from '../../middleware/auth';


const execAsync = promisify(exec);

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
  const { streamer } = c.req.param();
  console.log("inside the streamer route", streamer);
  const buttonIndex = c?.frameData?.buttonIndex;
  const userFid = c.frameData?.fid;

  if (buttonIndex == 1) {
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
    const isStreamLive = streamData.status == "live";
    console.log("The stream is live:", isStreamLive);

    const isUserSubscribed = await checkIfUserSubscribed(streamer, userFid!);
    console.log("Is user subscribed:", isUserSubscribed);

    if (isStreamLive) {
      console.log('THE STREAM IS LIVE');
      const latestClipInfo = await getLatestClipFromStream(streamer);
      console.log("The latest clip info is: ", latestClipInfo)
      if (!latestClipInfo) {
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
            <Button action={`/${streamer}`}>Retry</Button>,
          ],
        });
      }
      
      if (!latestClipInfo.hasClips) {
        return c.res({
          title: "vibra",
          image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
              <div tw="mb-20 flex text-3xl text-purple-400">
                @{streamer} is live!
              </div>
              <div tw="mt-3 flex text-3xl text-white">
                Be the first to create a clip!
              </div>
            </div>
          ),
          intents: [
            <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
              {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>,
            <Button action={`/create-first-clip/${streamer}/${latestClipInfo.streamId}`}>🎬</Button>,
            <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
            <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
          ],
        });
      }

      return c.res({
        title: "vibra",
        image: latestClipInfo.gifUrl,
        intents: [
          <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
            {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
          </Button>,
          <Button action={`/clips/${streamer}/${latestClipInfo.livepeerStreamId}/${latestClipInfo.index}`}>▶️</Button>,
          <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Watch Live 📺</Button.Link>,
          <Button action={`/download-app/${streamer}`}>Mobile App</Button>,
        ],
      });
    } else {
      console.log("THE STREAMER IS NOT LIVE ANYMORE");
      return c.res({
        title: "vibra",
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mb-20 flex text-xl text-purple-400">
              @{streamer} is not live anymore
            </div>
            <div tw="mt-3 flex text-xl text-white">
              Subscribe to get notified when they go live again
            </div>
          </div>
        ),
        intents: [
          <Button action={`/${streamer}/${isUserSubscribed ? "unsubscribe" : "subscribe"}`}>
            {isUserSubscribed ? "Unsubscribe" : "Subscribe"}
          </Button>,
          <Button action={`/clips/${streamer}`}>View Clips</Button>,
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
        <Button action={`/${streamer}`}>Watch Stream</Button>,
        <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
        <Button.Link href="https://www.vibra.so/android">Android</Button.Link>,
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
            You will receive a DM from @vibrabot.eth when they go live.
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
        <Button action={`/${streamer}`}>@{streamer}</Button>,
        <Button.Link href={`https://www.warpcast.com/${streamer}`}>DM {streamer}</Button.Link>,
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
         <Button action={`/${streamer}`}>Watch Stream</Button>,
         <Button.Link href={`https://testflight.apple.com/join/CtXWk0rg`}>iOS</Button.Link>,
         <Button.Link href="https://www.vibra.so/android">android</Button.Link>
        ],
  })
})

app.frame("/clips/:streamer/:streamId/:index", async (c) => {
  const { streamer, streamId, index } = c.req.param();
  console.log("Fetching clip for streamer:", streamer, "stream:", streamId, "index:", index);

  try {
    const clip = await prisma.clip.findFirst({
      where: { 
        stream: { id: streamId },
        clipIndex: parseInt(index)
      },
      orderBy: { clipIndex: 'desc' }
    });

    if (!clip) {
      console.log("No clip found for the given index");
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
          <Button action={`/clips/${streamer}/${streamId}/${parseInt(index) - 1}`}>Previous Clip</Button>,
          <Button action={`/${streamer}`}>Back to Stream</Button>,
        ],
      });
    }

    const prevClip = await prisma.clip.findFirst({
      where: { 
        stream: { id: streamId },
        clipIndex: { lt: clip.clipIndex }
      },
      orderBy: { clipIndex: 'desc' }
    });

    const nextClip = await prisma.clip.findFirst({
      where: { 
        stream: { id: streamId },
        clipIndex: { gt: clip.clipIndex }
      },
      orderBy: { clipIndex: 'asc' }
    });

    return c.res({
      title: `Vibra - ${streamer}'s Clip`,
      image: clip.cloudinaryUrl,
      intents: [
        prevClip ? <Button action={`/clips/${streamer}/${streamId}/${prevClip.clipIndex}`}>◀️</Button> : null,
        nextClip ? <Button action={`/clips/${streamer}/${streamId}/${nextClip.clipIndex}`}>▶️</Button> : null,
        <Button.Link href={`https://www.vibra.so/stream/${streamer}`}>Live 📺</Button.Link>,
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

