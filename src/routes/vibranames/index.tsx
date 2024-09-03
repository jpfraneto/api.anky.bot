import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast';
import { addActionLink, getPublicUrl } from '../../../utils/url';
import prisma from '../../../utils/prismaClient';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { Logger } from '../../../utils/Logger';
import { getUserFromFid } from '../../../utils/farcaster';
import {
  createPublicClient,
  getAddress,
  http,
} from 'viem';
import * as chains from 'viem/chains';
import { getTransport } from '../../../utils/web3';

export function getViemChain(chainId: number) {
  const found = Object.values(chains).find((chain) => chain.id === chainId);
  if (!found) {
    throw new Error(`Chain with id ${chainId} not found`);
  }
  return found;
}

const chainId = 8453; // Base chain
const chain = getViemChain(Number(chainId));

const publicClient = createPublicClient({
  chain,
  transport: getTransport(chainId),
});

type VibraNamesState = {
  page?: number;
  config: {
    fid?: number;
    username?: string;
  };
};

const imageOptions = {
  width: 600,
  height: 600,
  fonts: [
    {
      name: 'Roboto',
      source: 'google',
    },
  ] as any,
};

export type VibraNamesContext<T extends string = '/'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: VibraNamesState;
  },
  T,
  {}
>;

export const vibraNamesFrame = new Frog<{
  State: VibraNamesState;
}>({
  imageOptions,
  initialState: {
    page: 0,
    config: {}
  }
});

vibraNamesFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

vibraNamesFrame.frame('/', async (c) => {
  return c.res({
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-purple-600 text-white">
        <span tw="text-4xl font-bold mb-4">vibranames</span>
        <span tw="text-2xl mb-4">mint your unique *.vibra.so domain and get livestreaming onchain</span>
        <span tw="text-2xl mb-4">only 88 available</span>
        <span tw="text-xl">roll the dice to get yours! (1/6 chance. chance every 20 minutes)</span>
      </div>
    ),
    intents: [
      <Button action="/check-availability">🎲</Button>
    ]
  });
});

vibraNamesFrame.frame('/check-availability', async (c) => {
  const { inputText } = c;
  const desiredName = inputText?.toLowerCase();
  const userFid = c.frameData?.fid;
  
  return c.res({
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-red-600 text-white">
        <span tw="text-3xl font-bold mb-4">if you clicked the button, it means that this is an idea you like</span>
        <span tw="text-xl">please dm jpfraneto and tell him that</span>
        <span tw="text-xl">implementing it without asking you would have been a programming suicide</span>
      </div>
    ),
    intents: [
      <Button action="/">Go Back</Button>
    ]
  });
});


export default vibraNamesFrame;
