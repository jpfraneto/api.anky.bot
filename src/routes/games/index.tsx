import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, publishCastToTheProtocolThroughDummyBot, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import axios from 'axios';
import { Logger } from '../../../utils/Logger';
import { neynarClient } from '../../services/neynar-service';
import { DUMMY_BOT_SIGNER, NEYNAR_API_KEY } from '../../../env/server-env';
import { getUserFromFid } from '../../../utils/farcaster';
import queryString from 'query-string';
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

interface Game {
    originalFileName: string;
    secure_url: string;
  }
  
  interface Games {
    [key: string]: {
      gameVideoUrl: string;
      items: Game[];
    };
  }


const chainId = 8453
const chain = getViemChain(Number(chainId));

const games: Games = {
    megaman : {
        gameVideoUrl: "https://www.youtube.com/watch?v=6MWavA26oQs",
        items: [
            {
                "originalFileName": "output_0.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971897/jub0p49xlik5bs0noovu.gif"
            },
            {
                "originalFileName": "output_1.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971901/q4qksokyn8x5ic6kbsfo.gif"
            },
            {
                "originalFileName": "output_10.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971903/omsmydy6ekkq256tgzsw.gif"
            },
            {
                "originalFileName": "output_11.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971906/b5elz4emrtgfywglrlpz.gif"
            },
            {
                "originalFileName": "output_2.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971909/wyax67tsnrxkrn9ikqmf.gif"
            },
            {
                "originalFileName": "output_3.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971912/bjeafr3yhcew4d9yv4u9.gif"
            },
            {
                "originalFileName": "output_4.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971915/v9d3fs50vnlw0jfxasiz.gif"
            },
            {
                "originalFileName": "output_5.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971918/cj2lr8w2hb6o9wnlh70b.gif"
            },
            {
                "originalFileName": "output_6.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971921/lzaxk8wlole64dyjw69s.gif"
            },
            {
                "originalFileName": "output_7.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971924/far4sfrsvo3zifwggsrq.gif"
            },
            {
                "originalFileName": "output_8.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971926/qwupgkpnx3pcstmkupgs.gif"
            },
            {
                "originalFileName": "output_9.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720971929/qm1kdfmtrjxds2qy4kcj.gif"
            }
        ],
    },
    pokemonRed: {
        gameVideoUrl: "https://www.youtube.com/watch?v=hYcotDHI0dg",
        items: []
    },
    punchOut : {
        gameVideoUrl: "https://www.youtube.com/watch?v=HRR78fLJcmI",
        items:  [
            {
                "originalFileName": "output_0.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973117/xtzhomhucstjnfjtihme.gif"
            },
            {
                "originalFileName": "output_1.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973121/f6stxogsrhq9lt4vsqv2.gif"
            },
            {
                "originalFileName": "output_2.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973125/i6m4zcs9fmjcrdb7apwc.gif"
            },
            {
                "originalFileName": "output_3.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973128/uz4qg3vxh2dbdipxpkj1.gif"
            },
            {
                "originalFileName": "output_4.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973131/jxbcn5a7s7pjl6etc6mg.gif"
            },
            {
                "originalFileName": "output_5.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973135/emjdv4f6zjgw8mxqeepg.gif"
            },
            {
                "originalFileName": "output_6.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973139/ghaa3iu6l7rdsktbcalz.gif"
            },
            {
                "originalFileName": "output_7.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973141/g3buyydwmylwwzaswtmm.gif"
            },
            {
                "originalFileName": "output_8.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973145/a1nsjaouhslbvupspmix.gif"
            }
        ],
    } ,
    duckHunt: {
        gameVideoUrl: "https://www.youtube.com/watch?v=J3sfsP9W048",
        items: [
            {
                "originalFileName": "output_0.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973140/onpeob3syieqr2kd7g8b.gif"
            },
            {
                "originalFileName": "output_1.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973144/a9arogduf7epjlvnkrz7.gif"
            },
            {
                "originalFileName": "output_2.gif",
                "secure_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720973146/dookr8rw39kuyve8rx2r.gif"
            }
        ]   
    } ,

}

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

export const gamesFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

gamesFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

gamesFrame.frame('/', async (c) => {
  let imageUrl = "https://media1.giphy.com/media/26BRvIUi6zWRqRCFy/200w.gif?cid=6c09b9524wt29x6j4a4zoc9dvfvbmi6kth9jbmvt7ze6sjre&ep=v1_gifs_search&rid=200w.gif&ct=g"
  return c.res({
    title: 'gamecaster',
    image: imageUrl,
    intents: [
      <Button action={`/megaman/0`}>megaman</Button>,
      <Button action={`/duckHunt/0`}>duck hunt</Button>,
      <Button action={`/punchOut/0`}>punch out</Button>,
      <Button action={`/other`}>other</Button>,
    ],
  });
});



gamesFrame.frame('/:game/:index', async (c) => {
    const { game, index } = c.req.param();
    console.log("tjhe game is", game)
    const thisGameArray = games[game].items;
    console.log("ALOJA",games[game])
    const gameVideoUrl = games[game].gameVideoUrl;
    const currentIndex = Number(index);
    const gameImage = thisGameArray[currentIndex].secure_url;
    const nextIndex = (currentIndex + 1) % thisGameArray.length;
    const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : -1; // -1 to indicate the first element
    const totalItems = thisGameArray.length;
  
    const qs = {
      text: `nostalgia is a good feeling to have.\n\nby @jpfraneto 🎩`,
      'embeds[]': [
        `https://api.anky.bot/tv/${game}/${index}`,
      ],
    };
  
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
  
    return c.res({
      title: 'gamecaster',
      image: gameImage,
      intents: [
        <Button.Link href={warpcastRedirectLink}>share 🎮</Button.Link>,
        prevIndex === -1
          ? <Button.Link href={gameVideoUrl}>game 📺</Button.Link>
          : <Button action={`/${game}/${prevIndex}`}>◀️ prev</Button>,
        <Button action={`/${game}/${nextIndex}`}>next ▶️</Button>,
        <Button action="/">games list</Button>,
      ],
    });
  });

gamesFrame.frame('/other', async (c) => {
  return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/game-memores.png?raw=true",
      intents: [
          <TextInput placeholder="pokemon, zelda, etc" />,
          <Button action={`/recommend-game`}>recommend</Button>,
          <Button action={`/`}>back</Button>
        ],
  })
})

gamesFrame.frame('/recommend-game', async (c) => {
  const inputText = c.inputText
  const thisUserFid = c.frameData?.fid
  const user = await getUserFromFid(thisUserFid!)
  const ogFrameHash = "0x8068bc4e21fa0d59e5465e4a7b85d1f0083ebf13"
  let replyOptions = {
    text: `@${user.username} nominated ${inputText}\n\nfor the list of memorable games.\n\nwould you like to see it here?`,
    embeds: [],
    parent: ogFrameHash,
    signer_uuid: DUMMY_BOT_SIGNER,
  };
  const castedRecommendationHash  = await publishCastToTheProtocolThroughDummyBot(replyOptions)
  return c.res({
      title: "anky",
      image: "https://github.com/jpfraneto/images/blob/main/game-ty.png?raw=true",
      intents: [
          <Button.Link href={`https://www.warpcast.com/~/conversations/${castedRecommendationHash}`}>recommendation</Button.Link>,
          <Button.Link href={`https://www.vibra.so/`}>vibra?</Button.Link>
        ],
  })
})


