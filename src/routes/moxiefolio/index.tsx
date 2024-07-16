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
import { getUserFromFid, getUserFromUsername } from '../../../utils/farcaster';
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
import { getUserMoxieFantokens, updateMoxieFantokenEntry } from './utils';


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
    name: "M O X I E F O L I O", 
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
          <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
          <Button action={`/add-this-fantoken/${actionedCastFid}?add=true`}>add ftken</Button>,
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
  return response.data
}

moxiefolioFrame.frame('/add-member-to-moxiefolio', async (c) => {
  const textInput = c.frameData?.inputText!;
  const username = textInput.trim().split(" ")[0]
  const amountOfMoxie = textInput.split(" ")[1]
  const userToAdd = await getUserFromUsername(username)
  console.log("The user to add is", userToAdd)
  const usersFid = c.frameData?.fid!
  let targetUserFid = userToAdd.fid
  let targetAllocation = parseFloat(amountOfMoxie);
  const userAidropAllocation = await getUsersAidropAllocation(usersFid.toString())

  if (isNaN(targetUserFid) || isNaN(targetAllocation)) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Invalid input format. Please use "USERNAME ALLOCATION" (e.g., "jpfraneto 888").
          </div>
        </div>
      ),
      intents: [
        <TextInput placeholder='jpfraneto 8888' />,
        <Button action={`/add-member-to-moxiefolio`}>add member</Button>,
      ],
    });
  }

  try {
    const updatedMoxieFantokens = await updateMoxieFantokenEntry(usersFid, targetUserFid, targetAllocation);
    console.log("THE UPDATED MOXIE FANTOKENS ARE ", updatedMoxieFantokens)
    return c.res({
      title: 'moxiefolio',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Your moxiefolio was updated
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {updatedMoxieFantokens.entries.map((entry: MoxieFantokenEntry, i: number) => (
              <div tw="flex w-full text-left" key={i}>
                {i + 1}. {entry.targetUser.username} (FID: {entry.targetUser.id}) - {entry.allocation} $moxie - {Number((100 * entry.allocation/Number(userAidropAllocation)).toFixed(2))}%
              </div>
            ))}
          </div>
          <div tw="mt-3 flex text-xl text-white">
            Total allocated: {updatedMoxieFantokens.totalAllocated}%
          </div>
        </div>
      ),
      intents: [
        <Button action={`/edit-moxie-fantokens/${usersFid}`}>Edit again</Button>,
        <Button action={`/moxie-fantokens/${usersFid}`}>my moxiefolio</Button>
      ],
    });
  } catch (error) {
    console.error("Error updating Moxie Fantokens:", error);
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            An error occurred while updating your Moxie Fantokens
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my moxiefolio</Button>
      ],
    });
  }
})

moxiefolioFrame.frame('/this-users-moxiefolio/:fid', async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid
  try {
    let returnButtons;
    const usersMoxiefolio = await getUserMoxieFantokens(Number(fid))
    console.log("in here,,,", usersMoxiefolio)
    const usersAirdrop = await getUsersAidropAllocation(fid)
    console.log("aloooja", usersAirdrop)
    if(usersMoxiefolio == null) {
      returnButtons = [
        <TextInput placeholder='jpfraneto 8888' />,
        <Button action={`/add-member-to-moxiefolio`}>add member</Button>,
        <Button.Link
        href={addActionLink({
          name: 'moxie fantokens',
          postUrl: '/moxiefolio/moxiedistribution',
        })}
       >
        moxiefolio action
          </Button.Link>,,
      ]
      return c.res({
        title: "moxiefolio",
        image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mt-10 flex text-2xl text-purple-200">
              welcome to your moxiefolio
            </div>
            <div tw="mt-2 flex text-xl text-white">
              you don't have any members of farcaster on your it
            </div>
            <div tw="mt-2 flex text-xl text-white">
              you can add one below (the format is "[username] [amount to bet]")
            </div>
            <div tw="mt-2 flex text-xl text-white">
              or just install the cast action and call it on any cast to add it to that user
            </div>
            <div tw="mt-2 flex text-xl text-white">
              (your airdrop is {usersAirdrop.moxieAirdropAmount} $moxie, and you /can/ divide that on all the fantokens you want)
            </div>
          </div>
        ),
        intents: returnButtons,
      })
    } else {
      console.log('iiin here,', usersMoxiefolio)
      const totalAllocated = usersMoxiefolio.entries.reduce((acc: number, fanToken) => acc + fanToken.allocation, 0);
      const usersAirdrop = await getUsersAidropAllocation(fid)
      const percentage = Number((100*totalAllocated/Number(usersAirdrop)).toFixed(2))
      console.log("the percentage is: ", percentage)
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
              {usersMoxiefolio.entries.map((x,i) => (<div tw="flex w-full text-left">{i + 1}. {x.targetUser.username} - {x.allocation} $moxie</div>)
              )}
            </div>
            <div tw="mt-3 flex flex-col justify-center text-xl text-black">
              <div tw="w-full flex flex-col p-1 items-center bg-purple-300 rounded-xl">
                <div tw="flex w-full">{percentage}% of airdrop allocated</div>
                <div tw="flex w-full ">{totalAllocated} $moxie</div>
              </div>
              <div tw="w-full flex flex-col bg-green-300 rounded-xl">
                <div tw="flex w-full">{Number((1 - percentage).toFixed(2))}% of airdrop available</div>
                <div tw="flex w-full">{+usersAirdrop - totalAllocated} $moxie</div>
              </div>
  
            </div>
          </div>
        ),
        intents: returnButtons,
      })
    }
  } catch (error) {
    console.log("THERE WAS AN ERROR HERE", error)
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
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
  })
  }
})

moxiefolioFrame.frame('/moxiefolio/:fid', async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid
  let returnButtons;
  console.log('the users ifd', fid, usersFid)
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
      <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      <Button.Link href={`https://www.vibra.so`}>share mxflio</Button.Link>,
    ]
  }
  try {
    const usersMoxiefolio = await getUserMoxieFantokens(Number(fid))
    console.log("the users moxiefolio is: ", usersMoxiefolio)
    if(usersMoxiefolio == null) {
      const usersAirdrop = await getUsersAidropAllocation(fid)
      returnButtons = [
        <TextInput placeholder='888888 (no spaces/commas)' />,
        <Button action={`/update-airdrop-allowance/${usersFid}`}>create profile</Button>,
        <Button.Link href={`https://www.vibra.so`}>share mxflio</Button.Link>,
      ]
      return c.res({
        title: "moxiefolio",
        image: (
            <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
            <div tw="mt-10 flex text-xl text-white">
              welcome to your moxiefolio
            </div>
            <div tw="mt-2 flex text-xl text-purple-200">
              a tool for you to keep track of what you plan to do for the upcoming $moxie airdrop
            </div>
            <div tw="mt-2 flex text-xl text-white">
              your allowance is {usersAirdrop.moxieAirdropAmount} (airstack please open the API)
            </div>
            <div tw="mt-2 flex text-xl text-white">
              how much of that do you want to bet on 
            </div>
          </div>
        ),
        intents: returnButtons,
      })
    }
    const totalWeight = usersMoxiefolio.reduce((acc: number, user) => acc + user.moxiefolioWeight, 0);
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
          <div tw="mt-3 flex flex-col justify-center text-xl text-black">
            <div tw="flex flex-col p-1 items-center bg-purple-300 rounded-xl">
              <div tw="flex w-full">{percentage}% of airdrop allocated</div>
              <div tw="flex w-full ">{Math.floor(usersAirdrop.moxieAirdropAmount * percentage)} $moxie</div>
            </div>
            <div tw="flex flex-col bg-green-300 rounded-xl">
              <div tw="flex w-full">{Number((1 - percentage).toFixed(2))}% of airdrop available</div>
              <div tw="flex w-full">{Math.floor(usersAirdrop.moxieAirdropAmount * (1 - percentage))} $moxie</div>
            </div>

          </div>
        </div>
      ),
      intents: returnButtons,
    })
  } catch (error) {
    console.log("the error is: ", error)
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
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
  })
  }
})

moxiefolioFrame.frame(`/edit-moxiefolio/:fid`, async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid

  if (usersFid?.toString() !== fid) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            You can only edit your own Moxie Fantokens
          </div>
        </div>
      ),
      intents: [
        <Button action={`/moxie-fantokens/${usersFid}`}>back</Button>
      ],
    });
  }

  const textInput = c.frameData?.inputText!;
  const [username, newAllocationStr] = textInput.split(" ");
  const newAllocation = parseFloat(newAllocationStr);

  if (!username || isNaN(newAllocation)) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Invalid input. Please use format: "username allocation%"
          </div>
          <div tw="mt-10 flex text-xl text-white">
            Examples: "jpfraneto 12" || "pichi 33" || "downshift.eth 44"
          </div>
        </div>
      ),
      intents: [
        <TextInput placeholder="undefined 12" />,
        <Button action={`/update-moxiefolio/${fid}`}>edit</Button>,
        <Button action={`/moxie-fantokens/${fid}`}>cancel</Button>
      ],
    });
  }

  const moxieFantokens = await getUserMoxieFantokens(parseInt(fid))

  return c.res({
    title: 'Confirm Moxie Fantokens Update',
    image: (
      <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
        <div tw="mt-10 flex text-xl text-white">
          Update allocation for {username} to {newAllocation}%
        </div>
        <div tw="mt-2 flex text-xl text-white">
          Current allocations:
        </div>
        <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
          {moxieFantokens?.entries.map((entry, i) => (
            <div tw="flex w-full text-left" key={i}>
              {i + 1}. {entry.targetUser.username} - {entry.allocation}%
            </div>
          ))}
        </div>
      </div>
    ),
    intents: [
      <Button action={`/update-moxie-fantokens/${fid}?username=${username}&allocation=${newAllocation}`}>Confirm</Button>,
      <Button action={`/moxie-fantokens/${fid}`}>Cancel</Button>
    ],
  });
})

moxiefolioFrame.frame('/update-moxie-fantokens/:fid', async (c) => {
  const { fid } = c.req.param();
  const usersFid = c.frameData?.fid;
  
  if (usersFid?.toString() !== fid) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            You can only update your own Moxiefolio
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  }

  const { targetFid, allocation } = c.req.query();
  const inputText = c.frameData?.inputText;

  if (!targetFid && !inputText) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Invalid update parameters
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  }

  let targetUserFid: number;
  let newAllocation: number;

  if (targetFid) {
    targetUserFid = parseInt(targetFid as string);
    newAllocation = parseFloat(inputText || '0');
  } else {
    const [inputFid, inputAllocation] = inputText!.split(' ');
    targetUserFid = parseInt(inputFid);
    newAllocation = parseFloat(inputAllocation);
  }

  if (isNaN(targetUserFid) || isNaN(newAllocation)) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Invalid input format. Please use "FID ALLOCATION" (e.g., "12345 10").
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  }

  try {
    const updatedMoxieFantokens = await updateMoxieFantokenEntry(parseInt(fid), targetUserFid, newAllocation);

    return c.res({
      title: 'Moxiefolio Updated',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Your moxiefolio was updated
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {updatedMoxieFantokens.entries.map((entry: MoxieFantokenEntry, i: number) => (
              <div tw="flex w-full text-left" key={i}>
                {i + 1}. {entry.targetUser.username} (FID: {entry.targetUser.fid}) - {entry.allocation}%
              </div>
            ))}
          </div>
          <div tw="mt-3 flex text-xl text-white">
            Total allocated: {updatedMoxieFantokens.totalAllocated}%
          </div>
        </div>
      ),
      intents: [
        <Button action={`/edit-moxie-fantokens/${fid}`}>Edit again</Button>,
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  } catch (error) {
    console.error("Error updating Moxie Fantokens:", error);
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            An error occurred while updating your Moxie Fantokens
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  }
});

moxiefolioFrame.frame(`/add-this-fantoken/:fidToAddToMoxiefolio`, async (c) => {
  const { fidToAddToMoxiefolio } = c.req.param();
  const usersFid = c.frameData?.fid;
  
  if (!usersFid) {
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            User not authenticated
          </div>
        </div>
      ),
      intents: [
        <Button action="/">Back to Home</Button>
      ],
    });
  }

  try {
    const userToAdd = await getUserFromFid(Number(fidToAddToMoxiefolio));
    const usersMoxiefolio = await getUserMoxieFantokens(Number(usersFid));
    const usersAirdrop = await getUsersAidropAllocation(usersFid.toString());

    const totalAllocated = usersMoxiefolio ? usersMoxiefolio.entries.reduce((sum, entry) => sum + entry.allocation, 0) : 0;
    const availableAllocation = Math.max(0, 100 - totalAllocated);

    return c.res({
      title: 'Add Fantoken to Moxiefolio',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            Add {userToAdd.username} to your moxiefolio
          </div>
          <div tw="p-2 border border-white bg-purple-200 text-black mt-2 flex text-2xl text-white">
            Available allocation: {availableAllocation.toFixed(2)}%
          </div>
          <div tw="flex flex-col items-start my-3 text-black text-2xl justify-center p-2 rounded-xl bg-purple-200">
            {usersMoxiefolio?.entries.map((x, i) => (
              <div tw="flex w-full text-left" key={i}>
                {i + 1}. {x.targetUser.username} - {x.allocation}%
              </div>
            ))}
          </div>
          <div tw="mt-2 flex text-xl text-white">
            Your total airdrop: {usersAirdrop.moxieAirdropAmount} $MOXIE
          </div>
        </div>
      ),
      intents: [
        <TextInput placeholder="Allocation percentage" />,
        <Button action={`/update-moxiefolio/${usersFid}?targetFid=${fidToAddToMoxiefolio}`}>Add</Button>,
        <Button action={`/moxiefolio/${usersFid}`}>Cancel</Button>
      ],
    });
  } catch (error) {
    console.error("Error in /add-this-fantoken route:", error);
    return c.res({
      title: 'Error',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-xl text-white">
            An error occurred while processing your request
          </div>
        </div>
      ),
      intents: [
        <Button action={`/this-users-moxiefolio/${usersFid}`}>my mxflo</Button>,
      ],
    });
  }
});



