import { Button, FrameContext, Frog } from 'frog';
import { neynar } from 'frog/middlewares';
import fs from 'fs/promises';
import path from 'path';
import queryString from 'query-string';

type StreamerInfo = {
  fid: number;
  username: string;
  displayName: string;
  pfp: {
    url: string;
  };
  streamSeries: {
    title: string;
    description: string;
    category: string;
    slots: number[];
  };
};

type SuccessState = {
  fid?: number;
  streamerInfo?: StreamerInfo;
};

console.log('Initializing successFrame...');
export const successFrame = new Frog<{
  State: SuccessState;
}>({
  imageAspectRatio: "1:1",
  imageOptions: {
    width: 600,
    height: 600,
  },
});
console.log('successFrame initialized');

async function getStreamerInfo(fid: number): Promise<StreamerInfo | undefined> {
  console.log(`Attempting to get streamer info for FID: ${fid}`);
  const dataPath = path.join(process.cwd(), 'public', 'data', 'success_streamers.json');
  console.log(`Reading data from path: ${dataPath}`);
  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    console.log('Data file read successfully');
    const streamers: StreamerInfo[] = JSON.parse(data);
    console.log(`Parsed ${streamers.length} streamers from data`);
    const streamer = streamers.find(streamer => streamer.fid === fid);
    console.log(streamer ? `Found streamer with FID ${fid}` : `No streamer found with FID ${fid}`);
    return streamer;
  } catch (error) {
    console.error('Error reading or parsing streamer data:', error);
    return undefined;
  }
}

successFrame.frame('/', (c) => {
  console.log('Rendering root frame');
  return c.res({
    image: (
      <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
        <span tw="text-4xl font-bold mb-4">/success</span>
        <span tw="text-2xl mb-8">Are you ready to level up?</span>
      </div>
    ),
    intents: [
      <Button action="/get-mine">Get Mine</Button>
    ],
  });
});

successFrame.frame('/get-mine', async (c) => {
  console.log('Handling /get-mine frame');
  const { frameData } = c;
  const fid = frameData?.fid;
  console.log(`FID from frameData: ${fid}`);

  if (!fid) {
    console.log('No FID found, returning error message');
    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <span tw="text-3xl font-bold mb-4">Oops!</span>
          <span tw="text-xl mb-4">We couldn't identify you.</span>
          <span tw="text-xl">Please try again.</span>
        </div>
      ),
      intents: [
        <Button action="/">Back to Start</Button>
      ],
    });
  }

  console.log(`Attempting to get streamer info for FID: ${fid}`);
  const streamerInfo = await getStreamerInfo(fid);
  console.log(streamerInfo ? 'Streamer info found' : 'Streamer info not found');

  if (streamerInfo) {
    console.log('Rendering stream info for found streamer');
    const { streamSeries } = streamerInfo;
    const qs = {
      text: `/vibra just proposed me to this livestream based on my most popular casts. \n\nthoughts? would you watch?`,
      'embeds[]': [
        `https://frames.vibra.so/success/${fid}`,
      ],
    };
    
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;

    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white p-4">
          <span tw="text-3xl font-bold mb-4">Your Stream</span>
          <span tw="text-2xl mb-2">{streamSeries.title}</span>
          <span tw="text-xl mb-4 text-center">{streamSeries.description}</span>
          <span tw="text-lg">Category: {streamSeries.category}</span>
        </div>
      ),
      intents: [
        <Button.Link href={warpcastRedirectLink}>Share</Button.Link>,
      ],
    });
  } else {
    console.log('Rendering message for user not part of /success');
    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <span tw="text-3xl font-bold mb-4">You're Missing Out!</span>
          <span tw="text-xl mb-4">You're not part of /success.</span>
          <span tw="text-xl mb-4">On what world do you live?</span>
        </div>
      ),
      intents: [
        <Button.Link href="https://www.hypersub.xyz/s/success">Join /success</Button.Link>,
        <Button action="/">Back to Start</Button>
      ],
    });
  }
});

successFrame.frame('/:fid', async (c) => {
  const { fid } = c.req.param();
  const numericFid = parseInt(fid, 10);

  if (isNaN(numericFid)) {
    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <span tw="text-3xl font-bold mb-4">Invalid FID</span>
          <span tw="text-xl">Please provide a valid FID.</span>
        </div>
      ),
      intents: [
        <Button action="/">Back to Start</Button>
      ],
    });
  }

  const streamerInfo = await getStreamerInfo(numericFid);

  if (streamerInfo) {
    const { streamSeries, username } = streamerInfo;
    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white p-4">
          <span tw="text-xl mb-2">@{username}'s proposed livestream:</span>
          <span tw="text-2xl mb-2">{streamSeries.title}</span>
          <span tw="text-xl mb-4 text-center">{streamSeries.description}</span>
          <span tw="text-lg">Category: {streamSeries.category}</span>
        </div>
      ),
      intents: [
        <Button action="/get-mine">Check Mine</Button>
      ],
    });
  } else {
    return c.res({
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <span tw="text-3xl font-bold mb-4">Streamer Not Found</span>
          <span tw="text-xl">This FID is not associated with a /success streamer.</span>
        </div>
      ),
      intents: [
        <Button action="/">Back to Start</Button>
      ],
    });
  }
});

console.log('Frame setup complete');
export default successFrame;