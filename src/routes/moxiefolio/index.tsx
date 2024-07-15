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

export const moxiefolioFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

moxiefolioFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

moxiefolioFrame.castAction(
  "/moxiedistribution",
  (c) => {
    const { actionData } = c;
    const { castId, fid, messageHash, network, timestamp, url } = actionData;
    const actionedCastHash = castId.hash;
    const actionedFid = castId.fid
    const publicUrl = getPublicUrl()
    return c.res({
      type: "frame",
      path: `${publicUrl}/moxiefolio/castAction/${actionedCastHash}/${actionedFid}`,
    });
  },
  { 
    name: "moxiefolio", 
    icon: "diamond", 
    aboutUrl: "https://action.vibra.so", 
    description: "start organizing on how you will distribute your $moxie airdrop now"
  }
);


moxiefolioFrame.frame('/', async (c) => {
  const targetTimestamp = 1721919600;
  const currentTime = Math.floor(Date.now() / 1000);
  const timeLeft = Math.max(0, targetTimestamp - currentTime);

  const days = Math.floor(timeLeft / (60 * 60 * 24));
  const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
  const seconds = timeLeft % 60;

  const formattedTime = `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} left`;

  return c.res({
    title: 'moxie aidrop',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
        <span tw="text-purple-500 text-2xl mb-2">understand how to plan for the upcoming moxie airdrop</span>
        <div tw="flex text-4xl text-purple-200 mt-4">
          {formattedTime}
        </div>
    </div>
   ),
    intents: [
      <Button.Link
      href={addActionLink({
        name: 'moxie fantokens',
        postUrl: '/moxiefolio/moxiedistribution',
      })}
    >
      moxiefolio action
    </Button.Link>,
    <Button action="/how-it-works">how this works?</Button>,
  ],
  });
});

moxiefolioFrame.frame('/how-it-works', async (c) => {
  try {
    const userAirdrop = 12345
    const username = "jpfraneto"
    return c.res({
      title: 'Anky Genesis',
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center py-2 px-8 bg-black text-white">
          <div tw="text-4xl">moxie airdrop</div>
          <div tw="mt-2 flex text-2xl">
            you are {username}
          </div>
          <div tw="mt-2 flex text-2xl">
            your $moxie airdrop is {userAirdrop}.
          </div>
          <div tw="mt-2 flex text-2xl">
            you can buy farcaster's members FAN TOKENS with it
          </div>
          <div tw="mt-2 text-2xl flex flex-col w-full">
            <span>the system that you will install with this frame will help you do that. you can call the cast action on any cast and add that member of farcaster to your... </span><span tw="mx-auto text-7xl text-purple-400">moxiefolio</span>
          </div>
          <div tw="mt-2 flex text-2xl">
            by /vibra
          </div>
        </div>
      ),
      intents: [
        <Button.Link href="https://www.moxie.xyz">
          moxie?
        </Button.Link>,
         <Button.Link href="https://warpcast.com/burrrrrberry/0xbb396912">
         fan tokens?
        </Button.Link>,
        <Button.Link href="https://www.vibra.so">
          vibra?
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


moxiefolioFrame.frame('/castAction/:actionedCastHash/:actionedCastFid', async (c) => {
  const { actionedCastHash, actionedCastFid } = c.req.param();
  const { frameData } = c
  const usersFid = c.frameData?.fid
  const socialScoreOfUser = 3.03
  const thisCastScore = 12300
  return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mb-20 flex text-6xl text-purple-400">
            m o x i e f o l i o
          </div>
          <div tw="w-full p-4 flex flex-col rounded-xl border-white bg-purple-600">
            <div tw="mt-3 flex text-xl text-white">
              cast hash - {actionedCastHash}
            </div>
            <div tw="mt-3 flex text-xl text-white">
              users fid - {usersFid}
            </div>
            <div tw="mt-3 flex text-xl text-white">
              actioned cast's fid - {actionedCastFid}
            </div>
            <div tw="mt-3 flex text-xl text-white">
              (farscore) user social score - {socialScoreOfUser}
            </div>
            <div tw="mt-3 flex text-xl text-white">
              cast score  - {thisCastScore}
            </div>
          </div>
        </div>
      ),
      intents: [
          <Button action={`/moxiefolio/${actionedCastFid}`}>spy user</Button>,
          <Button action={`/moxiefolio/${usersFid}`}>my mxflo</Button>,
          <Button action={`/check-stats/${actionedCastHash}`}>add ftken</Button>,
          <Button action={`/how-it-works`}>wtf?</Button>,
        ],
  })
})

const usersFantokens: UserMoxiefolioItem[] = [
  { username: 'hcot', fid: 123, moxiefolioWeight: 10 },
  { username: 'lambchop', fid: 2222, moxiefolioWeight: 12 },
  { username: 'danicaswanson', fid: 2, moxiefolioWeight: 10 },
  { username: 'pentacle.eth', fid: 888, moxiefolioWeight: 23 },
  { username: 'jpfraneto', fid: 16098, moxiefolioWeight: 4 }
];

async function getUsersMoxiefolio(fid: string): Promise<UserMoxiefolioItem[]> {
  // In a real application, you'd fetch this data based on the fid
  // For now, we're just returning all users
  return usersFantokens;
}

async function updateUsersMoxiefolio(fid: string, newMoxieFolio: UserMoxiefolioItem[]): Promise<UserMoxiefolioItem[]> {
  // In a real application, you'd fetch this data based on the fid
  // For now, we're just returning all users
  return usersFantokens;
}


async function getUsersAidropAllocation(fid: string): Promise<{fid: number, moxieAirdropAmount: number}> {
  const response = await axios.get(`https://api.anky.bot/moxie-airdrop/${fid}`)
  console.log("THE RESPONSE IS: ", response)
  return response.data
}

moxiefolioFrame.frame('/moxiefolio/:fid', async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid
  let returnButtons;
  if(usersFid?.toString() == fid) {
    // this means the user is watching her moxiefolio
    returnButtons = [
      <TextInput placeholder='lambchop 13'/>,
      <Button action={`/edit-moxiefolio/${usersFid}`}>edit mxflio</Button>,
      <Button.Link href={`https://www.vibra.so`}>share</Button.Link>,
    ]
  } else {
    // this means that the user is watching another users moxiefolio
    returnButtons = [
      <Button action={`/moxiefolio/${usersFid}`}>my mxflio</Button>,
      <Button.Link href={`https://www.vibra.so`}>share mxflio</Button.Link>,
    ]
  }
  try {
    const usersMoxiefolio = await getUsersMoxiefolio(fid)
    const totalWeight = usersMoxiefolio.reduce((acc, user) => acc + user.moxiefolioWeight, 0);
    const usersAirdrop = await getUsersAidropAllocation(fid)
    const percentage = Number((totalWeight/100).toFixed(2))
    return c.res({
      title: "moxiefolio",
      image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            {fid}'s moxiefolio
          </div>
          <div tw="mt-2 flex text-xl text-purple-200">
            airdrop: {usersAirdrop.moxieAirdropAmount} $moxie
          </div>
          <div tw="mt-2 flex text-xl text-white">
            total fan tokens in moxiefolio: {usersMoxiefolio.length}
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {usersMoxiefolio.map((x,i) => (<div tw="flex w-full text-left">{i + 1}. {x.username} - {x.moxiefolioWeight}%</div>)
            )}
          </div>
          <div tw="mt-3 flex flex-col justify-center text-xl text-white">
            <div tw="flex w-full">{percentage}% of airdrop allocated</div>
            <div tw="flex w-full text-purple-300">{Math.floor(usersAirdrop.moxieAirdropAmount * percentage)}/{usersAirdrop.moxieAirdropAmount} $moxie</div>
          </div>
        </div>
      ),
      intents: returnButtons,
    })
  } catch (error) {
    return c.res({
      title: "moxiefolio",
      image: (
          <div tw="flex h-full w-full px-16 items-center justify-center bg-black text-white">
            <div tw="mt-10 flex text-4xl text-white">
              there was an error
            </div>
        </div>
      ),
      intents: [
          <Button action={`/generic-reply`}>users moxiefolio</Button>,
        ],
  })
  }
})

moxiefolioFrame.frame(`/edit-moxiefolio/:fid`, async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid
  if(usersFid?.toString() == fid){
    console.log("THIS IS INVALID BECAUSE THE FIDS DON'T CORRESPOND TO EACH OTHER")
  }
  const textInput = c.frameData?.inputText!
  console.log('the text input is: ', textInput)
  // sanitize data and check if everything exists
  const username = textInput.split(" ")[0]
  const newAllocation = textInput.split(" ")[1]
  const usersMoxiefolio = await getUsersMoxiefolio(fid)
  return c.res({
    title: 'vibra.so',
    image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            you are trying to update your allocation towards {username}
          </div>
          <div tw="mt-2 flex text-xl text-white">
            from 4% of your airdrop to {newAllocation}% of it
          </div>
          <div tw="mt-2 flex text-xl text-white">
            if you accept, this will be your new moxiefolio distribution
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {usersMoxiefolio.map((x,i) => (<div tw="flex w-full text-left">{i + 1}. {x.username} - {x.moxiefolioWeight}%</div>)
            )}
          </div>
          <div tw="mt-3 flex flex-col justify-center text-xl text-white">
            <div tw="flex w-full">after this, 80% of your airdrop will be allocated</div>
          </div>
        </div>
      ),
    intents: [
      <Button action={`/update-moxiefolio/${fid}`}>accept</Button>,
      <Button action={`/moxiefolio/${fid}`}>cancel</Button>
    ],
  });
})


moxiefolioFrame.frame('/update-moxiefolio/:fid', async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid
  if(usersFid?.toString() == fid){
    console.log("THIS IS INVALID BECAUSE THE FIDS DON'T CORRESPOND TO EACH OTHER")
  }
  // process the moxiefolio update for the user, call the database, update everything, and render the new moxiefolio for the user here
  const updatedUsersMoxiefolio = await updateUsersMoxiefolio(fid, [])
  const totalWeight = updatedUsersMoxiefolio.reduce((acc, user) => acc + user.moxiefolioWeight, 0);
  const percentage = Number((totalWeight/100).toFixed(2))
  const usersAirdrop = await getUsersAidropAllocation(fid)
  const newMoxiefolioLinkForUser = "i just updated my moxiefolio, preparing for the upcoming $moxie airdrop. did you? you can install the moxiefolio cast action on this frame. 👇🏽 https://www.vibra.so"
  return c.res({
    title: 'vibra.so',
    image: (
          <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            your moxiefolio was updated
          </div>
          <div tw="mt-2 flex text-xl text-white">
            this is the new one
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {updatedUsersMoxiefolio.map((x,i) => (<div tw="flex w-full text-left">{i + 1}. {x.username} - {x.moxiefolioWeight}%</div>)
            )}
          </div>
          <div tw="mt-3 flex flex-col justify-center text-xl text-white">
            <div tw="flex w-full">{percentage}% of airdrop allocated</div>
            <div tw="flex w-full text-purple-300">{Math.floor(usersAirdrop.moxieAirdropAmount * percentage)}/{usersAirdrop.moxieAirdropAmount} $moxie</div>
          </div>
        </div>
      ),
    intents: [
      <Button action={`/edit-moxiefolio/${fid}`}>edit again</Button>,
      <Button.Link href={newMoxiefolioLinkForUser}>share</Button.Link>
    ],
  });
})
