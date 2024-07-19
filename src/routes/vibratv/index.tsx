import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { abbreviateAddress } from '../../../utils/strings';
import axios from 'axios';
import queryString from 'query-string';
import { addActionLink } from '../../../utils/url';
import { Logger } from '../../../utils/Logger';
import { neynarClient } from '../../services/neynar-service';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import { checkIfCastHasVideo, getUserFromFid, getUserFromUsername } from '../../../utils/farcaster';
import {
  createPublicClient,
  erc20Abi,
  erc721Abi,
  getAddress,
  http,
} from 'viem';
import * as chains from 'viem/chains';
import { getUserMoxieFantokens, updateMoxieFantokenEntry } from './utils';
import { fetchCastInformationFromHash } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { checkVideoProcessingStatus, processCastVideo, queueCastVideoProcessing } from '../../../utils/video-processing';

type VibraState = {
  // profiles
  page?: number;
  config: {
    fid?: number;
    pfp_url?: string;
    username?: string;
    points?: number;
    rank?: number;
  };
};

type MoxieFantokenEntry = {
  targetUser: {
    username: string;
  };
  allocation: number;
};

type MoxieFantokens = {
  entries: MoxieFantokenEntry[];
};

type UserMoxiefolioItem = {
  username: string;
  fid: number;
  moxiefolioWeight: number;
}

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

export type VibraContext<T extends string = '/logic/:castHash'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: VibraState;
  },
  T,
  {}
>;

export const vibraTvFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

vibraTvFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

vibraTvFrame.castAction(
  "/install",
  async (c) => {
    const { actionData } = c;
    console.log("the action data is: ", actionData)
    const { castId, fid, messageHash, network, timestamp, url } = actionData;
    const actionedCastHash = castId.hash;
    const actionedFid = castId.fid
    const publicUrl = getPublicUrl()

    const cast = await fetchCastInformationFromHash(castId.hash)
    console.log("the cast is: ", cast)
    const doesCastHaveVideo = checkIfCastHasVideo(cast.embeds[0].url)
    console.log("DOES DCAST HAVE VIDEO ", doesCastHaveVideo)
    if(doesCastHaveVideo) {
      try {
        console.log('right before sending the fideo for processing')
        const jobId = await queueCastVideoProcessing(cast, actionedFid);
        console.log("right after processcastvideo function")
        return c.res({
          type: "frame",
          path: `${publicUrl}/vibratv/processing-video/${actionedCastHash}`,
        });
      } catch (error) {
        console.error('Error processing video:', error);
        return c.res({
          type: "frame",
          path: `${publicUrl}/vibratv/error-processing-video`,
        });
      }
    } else {
      return c.res({
        type: "frame",
        path: `${publicUrl}/vibratv/invalid-video`,
      });
    }
  },
  { 
    name: "vibra tv", 
    icon: "play", 
    aboutUrl: "https://www.vibra.so", 
    description: "help us curate videos for the initial launch of vibra"
  }
);


vibraTvFrame.frame('/save-video/:castHashToSave/:fidOfCurator', async (c) => {
  const { castHashToSave, fidOfCurator } = c.req.param()
  return c.res({
    title: 'moxie aidrop',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
        <span tw="text-purple-500 text-2xl mb-2">video being processed</span>
    </div>
   ),
    intents: [
    <Button action={`/processing-video/${castHashToSave}`}>refresh state</Button>,
  ],
  });
});

vibraTvFrame.frame('/processing-video/:castHashToSave', async (c) => {
  const { castHashToSave } = c.req.param();
  const status = await checkVideoProcessingStatus(castHashToSave);

  switch (status) {
    case 'COMPLETED':
      const savedVideo = await prisma.castWithVideo.findUnique({
        where: { castHash: castHashToSave }
      });

      if (savedVideo && savedVideo.gifUrl) {
        const qs = {
          text: `Wow! I just magically transformed a video into a GIF!`,
          'embeds[]': [
            `https://api.anky.bot/vibra/cast-gifs/${savedVideo.uuid}/${castHashToSave}`,
          ],
        };
        
        const shareQs = queryString.stringify(qs);
        const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;

        return c.res({
          title: 'Vibra TV - GIF Ready!',
          image: savedVideo.gifUrl,
          intents: [
            <Button.Link href={`https://res.cloudinary.com/dzpugkpuz/image/upload/v1721251888/zurf/cast_gifs/${savedVideo.uuid}.gif`}>Download Gif</Button.Link>,
            <Button.Link href={warpcastRedirectLink}>Share Frame</Button.Link>,
          ],
        });
      } else {
        // This shouldn't happen, but just in case
        return c.res({
          title: 'Vibra TV - Error',
          image: (
            <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
              <span tw="text-red-500 text-2xl mb-2">An error occurred while retrieving the GIF.</span>
            </div>
          ),
          intents: [
            <Button action={`/processing-video/${castHashToSave}`}>Try Again</Button>,
          ],
        });
      }

    case 'PROCESSING':
      return c.res({
        title: 'Vibra TV - Processing',
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
            <span tw="text-purple-500 text-2xl mb-2">The video is being transformed into a gif...</span>
            <span tw="text-white text-lg">This may take a few moments. Please check back soon!</span>
          </div>
        ),
        intents: [
          <Button action={`/processing-video/${castHashToSave}`}>Refresh Status</Button>,
        ],
      });

    case 'ERROR':
      return c.res({
        title: 'Vibra TV - Error',
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
            <span tw="text-red-500 text-2xl mb-2">An error occurred while processing your video.</span>
            <span tw="text-white text-lg">Please try again later or contact support if the issue persists.</span>
          </div>
        ),
        intents: [
          <Button action="/install">Try Another Video</Button>,
        ],
      });

    case 'NOT_FOUND':
    default:
      return c.res({
        title: 'Vibra TV - Not Found',
        image: (
          <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
            <span tw="text-yellow-500 text-2xl mb-2">Video not found or processing hasn't started.</span>
            <span tw="text-white text-lg">Please make sure you've submitted a video for processing.</span>
          </div>
        ),
        intents: [
          <Button action="/install">Start Over</Button>,
        ],
      });
  }
});

vibraTvFrame.frame('/invalid-video', async (c) => {
  return c.res({
    title: 'vibra tv',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
        <span tw="text-purple-500 text-2xl mb-2">do this on a cast that has a video on it</span>
    </div>
   )
  });
});

vibraTvFrame.frame('/', async (c) => {
  console.log("inside this route")
  const allVideos = await prisma.castWithVideo.findMany({})
  const randomVideo = allVideos[Math.floor(allVideos.length * Math.random())]
  if(randomVideo) {
    return c.res({
      title: 'moxie aidrop',
      image: randomVideo?.gifUrl!,
      intents: [
        <Button action={`/`}>new video</Button>,
        <Button.Link href={randomVideo.gifUrl}>Download Gif</Button.Link>,
        <Button.Link
        href={addActionLink({
          name: 'vibra tv',
          postUrl: '/vibratv/install',
        })}
      >
        install action
      </Button.Link>,
        <Button.Link href={`https://warpcast.com/~/conversations/${randomVideo.castHash}`}>
          original cast
        </Button.Link>
    ],
    });
  } else {
    return c.res({
      title: 'vibra tv',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-purple-500 text-2xl mb-2">there are no videos</span>
      </div>
     ),
      intents: [
        <Button.Link
        href={addActionLink({
          name: 'vibra tv',
          postUrl: '/vibratv/install',
        })}
      >
        install
      </Button.Link>,
    ],
    });
  }

});

