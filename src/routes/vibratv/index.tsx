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
    const doesCastHaveVideo = checkIfCastHasVideo(cast.embeds[0].url)
    console.log("does the cast have video?" , doesCastHaveVideo)
    if(doesCastHaveVideo) {
      return c.res({
        type: "frame",
        path: `${publicUrl}/vibratv/save-video/${actionedCastHash}/${actionedFid}`,
      });
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
  const { castHashToSave } = c.req.param()
  const savedVideo = await prisma.castWithVideo.findUnique({
    where: {
      castHash: castHashToSave
    }
  })
  if(savedVideo) {
    const qs = {
      text: `wow! i just magically transformed a gif into a video!`,
      'embeds[]': [
        `https://api.anky.bot/vibratv/gif/${castHashToSave}`,
      ],
    };
    
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
    return c.res({
      title: 'vibra tv',
      image: savedVideo.gifUrl,
      intents: [
      <Button.Link href={warpcastRedirectLink}>share gif</Button.Link>,
    ],
    });
  } else {
    return c.res({
      title: 'vibra tv',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-purple-500 text-2xl mb-2">the video is processing</span>
      </div>
     ),
      intents: [
      <Button action={`/processing-video/${castHashToSave}`}>refresh state</Button>,
    ],
    });
  }
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
