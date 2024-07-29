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
import queryString from 'query-string';


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

export const vibraFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

vibraFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

vibraFrame.frame('/', async (c) => {
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

vibraFrame.frame('/gifs/:username', async (c) => {
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



export const vibraColor = '#00FFFF';

export function VibraBackground(user: Author) {
  return (
    <div tw="flex flex-col items-center justify-center text-5xl">
       <div
        tw="relative flex h-full w-full flex-col items-center justify-center text-center text-2xl text-white"
        style={{
          backgroundImage: 'linear-gradient(white, #93FB77 )',
        }}
      >
        :)
      </div>
      <div tw="font-bold">vibra</div>
    </div>
  );
}



const livestreams = [
  {
      username: "undefined",
      titleOfTheLivestream: "programming like a ninja",
      durationSoFar: 45
  },
  {
      username: "ruthveda.eth",
      titleOfTheLivestream: "compassionate self inquiry",
      durationSoFar: 30
  },
  {
      username: "dwp",
      titleOfTheLivestream: "worpcasting",
      durationSoFar: 60
  },
  {
      username: "downshift.eth",
      titleOfTheLivestream: "learning how to architecture complex systems",
      durationSoFar: 50
  },
  {
      username: "maretus",
      titleOfTheLivestream: "daily $degen raffle",
      durationSoFar: 20
  },
  {
      username: "wake",
      titleOfTheLivestream: "you are it",
      durationSoFar: 75
  },
  {
      username: "burrrrrberry",
      titleOfTheLivestream: "friday poker night",
      durationSoFar: 90
  },
  {
      username: "deployer",
      titleOfTheLivestream: "cook that HAM",
      durationSoFar: 25
  },
  {
      username: "pichi",
      titleOfTheLivestream: "walking the streets of tokyo",
      durationSoFar: 40
  },
  {
      username: "mazmhussain",
      titleOfTheLivestream: "the power of farcaster",
      durationSoFar: 35
  },
  {
      username: "tayzonday",
      titleOfTheLivestream: "let the chocolate rain",
      durationSoFar: 55
  },
  {
      username: "dwr",
      titleOfTheLivestream: "how to turn fans into evangelizers",
      durationSoFar: 80
  }
];

// frame que comparte el usuario cuando empieza su stream
vibraFrame.frame('/livestream/:streamer/:tokenAddress', async (c) => {
  const { streamer, tokenAddress } = c.req.param();
  return c.res({
    title: 'vibra.so',
    image: 'https://github.com/jpfraneto/images/blob/main/guty.png?raw=true',
    intents: [
      <TextInput placeholder='wena manu' />,
      <Button action="/index">
        more livestreams
      </Button>,
      <Button action={`/generate-link/${streamer}/${tokenAddress}`}>
        generate link
      </Button>
  ],
  });
});

// frame que comparte el usuario cuando empieza su stream
vibraFrame.frame('/cast-gifs/:uuid/:castHash', async (c) => {
  const { uuid, castHash } = c.req.param();
  const qs = {
    text: `hey @jpfraneto! can you send me an invite for /vibra?`,
    'embeds[]': [
      `https://frames.vibra.so/vibra/cast-gifs/${uuid}/${castHash}`,
    ],
  };
  
  const shareQs = queryString.stringify(qs);
  const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
  return c.res({
    title: 'vibra.so',
    image: `https://res.cloudinary.com/dzpugkpuz/image/upload/v1721251888/zurf/cast_gifs/${uuid}.gif`,
    intents: [
      <Button.Link href={warpcastRedirectLink}>
        share frame
      </Button.Link>,
      <Button.Link href={`https://res.cloudinary.com/dzpugkpuz/image/upload/v1721251888/zurf/cast_gifs/${uuid}.gif`}>Download Gif</Button.Link>,
      <Button.Link href={`https://warpcast.com/~/conversations/${castHash}`}>
        original cast
      </Button.Link>
  ],
  });
});

vibraFrame.frame('/generate-link/:streamer/:tokenAddress', async (c) => {
  const body = await c.req.json();
  let { streamer, tokenAddress } = c.req.param();
  const { frameData } = c
  console.log("111", frameData)
  const thisUserFid = c.frameData?.fid
  console.log("aloja", thisUserFid)
  tokenAddress = "0x9d7d5a2d0985a0206d72a0c1087b1a4fc9614cd3"
  const user = await getUserFromFid(thisUserFid!)
  const userVerifiedAddresses = user.verified_addresses.eth_addresses
  let totalBalance = BigInt(0);

  const balancePromises = userVerifiedAddresses.map(async (userWalletAddress : string) => {
    Logger.info(`Reading ERC-1155 ${tokenAddress}`);
    return publicClient.readContract({
      abi: HYPERSUB_ABI,
      address: getAddress(tokenAddress) as `0x${string}`,
      functionName: 'balanceOf',
      args: [userWalletAddress as `0x${string}`],
    });
  });
  const balances = await Promise.all(balancePromises);
  console.log("THE BALANCES ARE", balances)
  totalBalance = balances.reduce((acc, balance) => acc + BigInt(balance), BigInt(0));
  console.log("the total balance is", totalBalance )
  if(totalBalance > BigInt(0)) {
    return c.res({
      title: 'vibra.so',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-4xl mb-2">weeeelcome</span>
          <p tw="text-cyan-500 text-6xl mb-2">this view is coming soon</p>
      </div>
    ),
      intents: [
        <Button action={`/index`}>
        back
        </Button>,
        <Button.Link href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
          go to stream
        </Button.Link>
    ],
    });
  } else {
    const tokenPrice = 3
    return c.res({
      title: 'vibra.so',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-4xl mb-2">this view is</span>
          <p tw="text-cyan-500 text-6xl mb-2">coming soon</p>
      </div>
    ),
      intents: [
        <Button action={`/livestream/${streamer}/${tokenAddress}`}>
          back
        </Button>,
        <Button.Transaction target={`/get-creator-token/${streamer}`}>
          buy
        </Button.Transaction>
    ],
    });
  }
});

vibraFrame.frame('/index', async (c) => {
  return c.res({
      title: "vibra.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">active livestreams</span>
          {livestreams.map((x,i) => {
            return <p tw="text-left text-xl text-purple-300 mb-1">{i + 1}. {x.titleOfTheLivestream.toLowerCase()} - @{x.username}</p>
          })}
          <span tw="text-cyan-500 text-2xl">enter livestream index below to get more information</span>
      </div>
    ),
      intents: [
          <TextInput placeholder="enter livestream index (1, 2, 3)" />,
          <Button action={`/`}>back</Button>,
          <Button action={`/more-info/${c?.frameData?.fid}`}>stream info</Button>,
          <Button action={`/what-is-vibra`}>vibra?</Button>,
      ],
  })
})

vibraFrame.frame('/what-is-vibra', async (c) => {
  return c.res({
      title: "vibra.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">RELEASE THE BRAINZ</span>
          <span tw="text-purple-500 text-2xl mb-2">QUE VENGA LA BUENA VIBRA</span>
          <span tw="text-yellow-500 text-4xl mb-2">stream. be yourself.</span>
      </div>
    ),
      intents: [
          <Button.Link href={`https://www.vibra.so/`}>learn more</Button.Link>
      ],
  })
})

vibraFrame.frame('/android-testers', async (c) => {
  return c.res({
      title: "vibra.so",
      image: "https://github.com/jpfraneto/images/blob/main/vibraframe.png?raw=true",
      intents: [
          <TextInput placeholder="newclient@warpcast.com" />,
          <Button action={`/android-tester-submit`}>submit email</Button>
      ],
  })
})

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): boolean {
  return emailRegex.test(email);
}


vibraFrame.frame('/android-tester-submit', async (c) => {
  const { deriveState, inputText, buttonValue, frameData } = c;
  const fid = frameData?.fid
  const emailString = inputText
  if(!isValidEmail(emailString!)) {
    return c.res({
      title: "vibra.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">this email</span>
          <span tw="text-purple-500 text-2xl mb-2">{emailString}</span>
          <span tw="text-yellow-500 text-4xl mb-2">is not valid</span>
      </div>
    ),
    intents: [
      <TextInput placeholder="newclient@warpcast.com" />,
      <Button action={`/android-tester-submit`}>submit email</Button>
  ],
  })
  }
  const upsertTester = await prisma.androidTesters.upsert({
    where: {
      fid: Number(fid),
    },
    update: {
      email: emailString,
    },
    create: {
      fid: Number(fid),
      email: emailString,
    },
  });
  return c.res({
      title: "vibra.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-3 00 text-2xl mb-2">thank you, we will reach back soon at</span>
          <span tw="text-cyan-500 text-2xl mb-2">{emailString}</span>
          <span tw="text-purple-500 text-2xl mb-2">RELEASE THE BRAINZ</span>
          <span tw="text-yellow-500 text-4xl mb-2">QUE VENGA LA BUENA VIBRA</span>
      </div>
    ),
      intents: [
          <Button.Link href={`https://www.vibra.so/`}>learn more</Button.Link>
      ],
  })
})

vibraFrame.frame('/more-info/:fid', async (c) => {
  const { deriveState, inputText, buttonValue } = c;
  const { fid } = c.req.param();
  const livestreamIndex = Number(inputText);

  if (livestreamIndex > 0 && livestreamIndex < 13) {
    const chosenLivestream = livestreams[livestreamIndex - 1];

    return c.res({
      title: "vibra.so",
      image: "https://frames.vibra.so/generate-image",
      intents: [
        <Button action={`/index`}>back</Button>,
        <Button action={`/generate-link/${chosenLivestream.username}/0x1234`}>
          generate link
        </Button>
      ],
    });
  } else {
    return c.res({
      title: "vibra.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">active livestreams</span>
          {livestreams.map((x, i) => {
            return <p tw="text-left text-xl text-purple-300 mb-1">{i + 1}. {x.titleOfTheLivestream.toLowerCase()} - {x.username}</p>;
          })}
          <span tw="text-cyan-500 text-2xl">enter livestream index below to get more information</span>
        </div>
      ),
      intents: [
        <TextInput placeholder="enter livestream index (1, 2, 3)" />,
        <Button action={`/video`}>back</Button>,
        <Button action={`/more-info/${c?.frameData?.fid}`}>get info</Button>,
        <Button action={`/what-is-vibra`}>vibra?</Button>,
      ],
    });
  }
});


vibraFrame.get("/v", async (c) => {
  const { limit } = c.req.query();
  const videos = await prisma.zurfVideo.findMany({ })
  
  return c.json({videos} || {123:456})
})


vibraFrame.get("/v/:id", async (c) => {
  const { id } = c.req.param();
  const video = await prisma.zurfVideo.findUnique({
    where: {
      id: id
    }
  })  
  return c.json(video || {123:456})
})


vibraFrame.frame('/leaderboard/:id', async (c) => {
  const { id } = c.req.param();
  console.log("inside the leaderboard route", id)
  const leaderboard = [
    {
      username: "undefined",
      pfp_url: "",
      points: 888,
      rank: 1,

    },
    {
      username: "natedevxyz",
      pfp_url: "",
      points: 777,
      rank: 2,
    },
    {
      username: "accesmble",
      pfp_url: "",
      points: 666,
      rank: 3,
    },
    {
      username: "jpfraneto",
      pfp_url: "",
      points: 33,
      rank: 4,
    }
  ]
  return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-7xl mb-2">VIBRA</span>
          {leaderboard.map((user, i) => {
            return <span tw="mb-2 text-xl">{user.rank}.        @{user.username}...... {user.points} points</span>
          })}
      </div>
    ),
      intents: [
          <Button action={`/video/${id}`}>back</Button>,
          <Button.Link href={`https://www.vibra.so/`}>vibra</Button.Link>,
      ],
  })
})


vibraFrame.frame('/video/:id/generate-link', async (c) => {
  const body = await c.req.json();
  let { id } = c.req.param();
  const { frameData } = c
  const thisUserFid = c.frameData?.fid
  let tokenAddress = "0x235cad50d8a510bc9081279996f01877827142d8"
  const user = await getUserFromFid(thisUserFid!)
  const userVerifiedAddresses = user.verified_addresses.eth_addresses
  let totalBalance = BigInt(0);

  const balancePromises = userVerifiedAddresses.map(async (userWalletAddress : string) => {
    Logger.info(`Reading ERC-1155 ${tokenAddress}`);
    return publicClient.readContract({
      abi: MOXIE_PASS_ABI,
      address: getAddress(tokenAddress) as `0x${string}`,
      functionName: 'balanceOf',
      args: [userWalletAddress as `0x${string}`],
    });
  });
  const balances = await Promise.all(balancePromises);
  console.log("THE BALANCES ARE", balances)
  totalBalance = balances.reduce((acc, balance) => acc + BigInt(balance), BigInt(0));
  console.log("the total balance is", totalBalance )
  if(totalBalance == BigInt(0)) {
    return c.res({
      title: 'vibra.so',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-3xl mb-2">welcome</span>
          <p tw="text-cyan-500 text-6xl mb-2">DC @jpfraneto to see this video inside /vibra</p>
      </div>
    ),
      intents: [
        <Button action={`/index`}>
          back
        </Button>,
        <Button.Link href="https://warpcast.com/~/channel/vibra">
          follow /vibra
        </Button.Link>
    ],
    });
  } else {
    return c.res({
      title: 'vibra.so',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-4xl mb-2">welcome</span>
          <p tw="text-cyan-500 text-6xl mb-2">DC @jpfraneto to view this video inside /vibra</p>
      </div>
    ),
      intents: [
        <Button.Link href="https://moxie-frames.airstack.xyz/mpi?k=16098-cc9_D_HfyMSj3vRmLSrUa&u=16098&w=0xc669e04070ce18bf24ffa69fe311b64585f400d6">
            mint
        </Button.Link>
    ],
    });
  }
})


vibraFrame.frame('/video/:id', async (c) => {
  let { id } = c.req.param();
  console.log("here here", c.frameData)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  
  const gifUrl =`https://storage.googleapis.com/zurf-app-lens/${id}-gif`
  const castHash = "0xxxxxxxx"
  if (uuidRegex.test(id)) {
    return c.res({
      title: "vibra",
      image: gifUrl,
      intents: [
        <Button action={`/what-is-vibra`}>vibra?</Button>,
        <Button action={`https://www.vibra.so/post/${castHash}`}>view video</Button>
      ],
    });
  } else {
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-7xl mb-2">vibra</span>
          <span tw="text-yellow-500 text-4xl mb-2">this video was not found</span>
        </div>
      ),
      intents: [
        <Button action={`/`}>back</Button>,
        <Button.Link href={`https://www.vibra.so/`}>record new</Button.Link>,
      ],
    });
  }
});

vibraFrame.frame('/video/:id/:castHash', async (c) => {
  let { id, castHash } = c.req.param();
  console.log("here here", c.frameData)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  
  const gifUrl =`https://storage.googleapis.com/zurf-app-lens/${id}-gif`
  if (uuidRegex.test(id)) {
    return c.res({
      title: "vibra",
      image: gifUrl,
      intents: [
        <Button action={`/what-is-vibra`}>vibra?</Button>,
        <Button action={`https://www.vibra.so/post/${castHash}`}>view video</Button>
      ],
    });
  } else {
    return c.res({
      title: "vibra",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-7xl mb-2">vibra</span>
          <span tw="text-yellow-500 text-4xl mb-2">this video was not found</span>
        </div>
      ),
      intents: [
        <Button action={`/`}>back</Button>,
        <Button.Link href={`https://www.vibra.so/`}>record new</Button.Link>,
      ],
    });
  }
});


vibraFrame.frame('/aloja', async (c) => {
  return c.res({
      title: "anky",
      image: `https://res.cloudinary.com/dzpugkpuz/image/upload/v1720556901/output_y10821.gif`,
      intents: [
          <Button action={`/leaderboard/123`}>leaderboard</Button>,
          <Button.Link href={`https://www.guarpcast.com/v`}>vibra</Button.Link>,
        ],
  })
})

vibraFrame.frame('/landing', async (c) => {
  return c.res({
      title: "anky",
      image: `https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/fba9568e-5644-43f4-14f6-fd2de153a100/original`,
      intents: [
          <Button.Link href={`https://www.vibra.so/`}>vibra</Button.Link>,
        ],
  })
})


