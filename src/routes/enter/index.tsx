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

export const enterFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

enterFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

enterFrame.frame('/', async (c) => {
  return c.res({
    title: 'vibra.so',
    image: "https://github.com/jpfraneto/images/blob/main/bywoutput.gif?raw=true",
    intents: [
      <Button action={`/adentro`}>vibra</Button>
    ],
  });
});

enterFrame.frame('/adentro', async (c) => {
  return c.res({
    title: 'vibra.so',
    image: "https://github.com/jpfraneto/images/blob/main/output_color.gif?raw=true",
    intents: [
      <Button.Link href={`https://www.vibra.so/`}>vibra</Button.Link>,
    ],
  });
});

enterFrame.frame('/', async (c) => {
  const timestamp = new Date().getTime()
  
  return c.res({
    title: 'vibra.so',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
        <span tw="text-purple-500 text-2xl mb-2">QUE VENGA LA BUENA VIBRA</span>
        <span tw="text-yellow-500 text-4xl mb-2">{timestamp}</span>
    </div>
   ),
    intents: [
      <Button action="/index">
        more livestreams
      </Button>,
      <Button.Link href="https://3061541.cargo.site/">{timestamp.toString()}</Button.Link>,
  ],
  });
});

