import { Button, FrameContext, Frog, TextInput } from 'frog';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, publishCastToTheProtocol, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { Logger } from '../../../utils/Logger';
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
import { callChatGTPToGetJSONReply } from '../../../utils/ai';
import { ANKY_SIGNER, DUMMY_BOT_SIGNER, NEYNAR_API_KEY, NEYNAR_DUMMY_BOT_API_KEY } from '../../../env/server-env';


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

export const replyToDanFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

replyToDanFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

let marketingCastHash = "0xb57a72e87bc7ed580553e22c2c30101086ea2146"

replyToDanFrame.frame('/', async (c) => {
  console.log("inside the reply to dan frame")
  return c.res({
    title: 'fc marketing',
    image: "https://github.com/jpfraneto/images/blob/main/anon-reply.png?raw=true",
    intents: [
      <TextInput placeholder='appreciate feedback, etc'/>,
      <Button.Link href={`https://www.warpcast.com/~/conversations/${marketingCastHash}`}>original cast</Button.Link>,
      <Button action={`/replied`}>📭</Button>
    ],
  });
});

replyToDanFrame.frame('/replied', async (c) => {
  const userFeedback = c.frameData?.inputText!.trim();
  if(userFeedback && userFeedback?.length < 10) {
    return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
            "{userFeedback}"
          </div>
          <div tw="mt-10 flex text-4xl text-white">
            low effort. try harder
          </div>
        </div>
      ),
      intents: [
        <TextInput placeholder='be more welcoming, etc'/>,
        <Button action={`/replied`}>📭</Button>
        ],
    })
  } else {
    const systemPrompt = "you are a helpful assistant that understands the context of a decentralized social media platform called farcaster. a user of that platform is giving anonyomous feedback to the leader of it, replying to a post where the leader (which's name is Dan Romero) said: 'thats my job (being the marketing person of the company that creates the protocol and its main client), what am i not doing?.\n\nyou are going to receive what a user wrote, and your mission is to process the reply of the user and return a json object that has the following properties with its explanations:\n\n {isValidFeedback: <>a boolean assertion if this is valid feedback or not</>, snarkyReplyToUser: <>imagine you are the sarcastic leader of this platoform that finally tried lsd and opened his mind and your mission is to make the user that gave this feedback feel ridiculous. you are bullying the user, but in a fun way and this is the reply that you are producing for that purpose, based on what the user said. always end up this reply with: 'if you don't like this, build your own client.'</>}'"
    const userPrompt = userFeedback!
    const response = await callChatGTPToGetJSONReply(systemPrompt, userPrompt)
    const parsedResponse = JSON.parse(response!)
    const isValidFeedback = parsedResponse?.isValidReply!
    const snarkyReply = parsedResponse?.snarkyReplyToUser!
    let castOptions = {
      text: userFeedback!,
      embeds: [],
      parent: marketingCastHash,
      signer_uuid: DUMMY_BOT_SIGNER,
    };
    const castResponse = await publishCastToTheProtocol(castOptions, NEYNAR_DUMMY_BOT_API_KEY);
    let castOptions2 = {
      text: snarkyReply,
      embeds: [],
      parent: castResponse.hash,
      signer_uuid: ANKY_SIGNER,
    };
    const castResponse2 = await publishCastToTheProtocol(castOptions2, NEYNAR_API_KEY);
    return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex w-5/6 text-4xl text-white">
            DONE.
          </div>
        </div>
      ),
      intents: [
        <Button.Link href={`https://www.warpcast.com/~/conversations/${castResponse2.hash}`}>see reply</Button.Link>,
        ],
    })
  }
});