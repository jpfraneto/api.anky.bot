import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import axios from 'axios';
import { addActionLink } from '../../../utils/url';
import { Logger } from '../../../utils/Logger';
import { neynarClient } from '../../services/neynar-service';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import { getUserFromFid } from '../../../utils/farcaster';
import {
  createPublicClient,
  erc20Abi,
  erc721Abi,
  getAddress,
  http,
} from 'viem';
import * as chains from 'viem/chains';
import { ALCHEMY_INSTANCES, getTransport } from '../../../utils/web3';
import { HYPERSUB_ABI } from '../../constants/abi/HYPERSUB_ABI';
import { MOXIE_PASS_ABI } from '../../constants/abi/MOXIE_PASS_ABI';


export function getViemChain(chainId: number) {
  const found = Object.values(chains).find((chain) => chain.id === chainId);
  if (!found) {
    throw new Error(`Chain with id ${chainId} not found`);
  }

  return found;
}


const chainId = 8453
const chain = getViemChain(Number(chainId));

const publicClient = createPublicClient({
chain,
transport: getTransport(chainId),
});

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

export const fanTokenDistribution = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

fanTokenDistribution.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

fanTokenDistribution.castAction(
  "/moxie-distribution",
  (c) => {
    console.log("IN HEREEEEEEE")
    const { actionData } = c;
    const { castId, fid, messageHash, network, timestamp, url } = actionData;
    const actionedCastHash = castId.hash;
    const actionedFid = castId.fid
    console.log("IN HERE98sa78sca", actionedCastHash, actionedFid)
    const publicUrl = getPublicUrl()
    return c.res({
      type: "frame",
      path: `${publicUrl}/fantokendistribution/castAction/${actionedCastHash}/${actionedFid}`,
    });
  },
  { 
    name: "moxie fantokens", 
    icon: "eye", 
    aboutUrl: "https://action.vibra.so", 
    description: "start thinking on how you will distribute your $moxie airdrop now"
  }
);

fanTokenDistribution.frame('/castAction/:actionedCastHash/:actionedCastFid', async (c) => {
  const { actionedCastHash } = c.req.param();
  console.log("the actioned cast hash is", actionedCastHash)
  return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
            hello ser
          </div>
          <div tw="mt-10 flex text-4xl text-white">
            what do you want to do?
          </div>
          <div tw="p-8 flex flex-col rounded-xl border-white bg-purple-600">
            <div tw="mt-10 flex text-xl text-white">
              cast hash
            </div>
            <div tw="mt-10 flex text-xl text-white">
              {actionedCastHash}
            </div>
          </div>
          <div tw="mt-20 flex text-4xl text-gray-500">
            Made with ❤️ by <span tw="ml-2 text-white">@jpfraneto</span>
          </div>
        </div>
      ),
      intents: [
          <TextInput placeholder="bad reply url/hash" />,
          <Button action={`/generic-reply/${actionedCastHash}`}>generic reply</Button>,
          <Button action={`/submit-reply-triade/${actionedCastHash}`}>add triade</Button>,
          <Button action={`/check-stats/${actionedCastHash}`}>check stats</Button>,
          <Button action={`/check-score/${actionedCastHash}`}>check my score</Button>,
        ],
  })
})

fanTokenDistribution.frame('/', async (c) => {
  return c.res({
    title: 'vibra.so',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
        <span tw="text-purple-500 text-2xl mb-2">understand how to distribute your moxie airdrop</span>
    </div>
   ),
    intents: [
      <Button.Link
      href={addActionLink({
        name: 'moxie fantokens',
        postUrl: '/moxie-distribution',
      })}
    >
      Add Moxie Action
    </Button.Link>,
    <Button action="/how-it-works">how this works?</Button>,
  ],
  });
});

fanTokenDistribution.frame('/how-it-works', async (c) => {
  try {
    const userAirdrop = 12345
    return c.res({
      title: 'Anky Genesis',
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center p-2 bg-black text-white">
          <div tw="text-4xl">moxie airdrop</div>
          <div tw="mt-2 flex text-2xl">
            your $moxie airdrop is {userAirdrop}.
          </div>
          <div tw="mt-2 flex text-2xl">
            you can buy farcaster's members with it
          </div>
          <div tw="mt-2 flex text-2xl">
            the system that you will install with this frame will help you do that
          </div>
        </div>
      ),
      intents: [
        <Button.Link href="https://www.moxie.xyz">
          moxie
        </Button.Link>,
        <Button action="/">
          back
        </Button>,
    ],
    });
  } catch (error) {
    console.log("there was an error")
    return c.res({
      title: 'Anky Genesis',
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">THERE WAS AN ERROR!</div>
          <div tw="mt-5 flex text-3xl">
            Made with ❤️ by{' '}
            <span
              tw="ml-1"

            >
              @jpfraneto
            </span>
          </div>
        </div>
      ),
      intents: [
        <Button.Link href="https://www.moxie.xyz">
          moxie
        </Button.Link>,
        <Button action="/">
          back
        </Button>,
    ],
    });
  }
})

fanTokenDistribution.frame('/gifs/:username', async (c) => {
  const { username } = c.req.param();
  let imageUrl = "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720814025/agprlpuqgvpblbgfsljy.gif"
  if(username == "brad"){
    imageUrl = "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720814025/brad.gif"
  }
  return c.res({
    title: 'vibra.so',
    image: imageUrl,
    intents: [
      <Button action={`/what-is-vibra`}>vibra?</Button>
    ],
  });
});