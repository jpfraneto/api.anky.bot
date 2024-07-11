import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author, Cast } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase, getCastRepliesFromHash } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { NeynarVariables } from 'frog/middlewares';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import axios from 'axios';
import { getAnkysInterpretation } from './anky';

type SadhanaState = {
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

export type SadhanaContext<T extends string = '/logic/:castHash'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: SadhanaState;
  },
  T,
  {}
>;

export const sadhanaFrame = new Frog<{
  State: SadhanaState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

export const sadhanaColor = '#00FFFF';

export function VibraBackground(user: Author) {
  return (
    <div tw="flex flex-col items-center justify-center text-5xl">
       <div
        tw="relative flex h-full w-full flex-col items-center justify-center text-center text-2xl text-white"
        style={{
          backgroundImage: 'linear-gradient(white, #93FB77 )',
        }}
      >
        🧘🏼‍♂️
      </div>
      <div tw="font-bold">sadhana</div>
    </div>
  );
}

sadhanaFrame.frame('/', async (c) => {
    return c.res({
      title: 'onda.so',
      image: 'https://github.com/jpfraneto/images/blob/main/guty.png?raw=true',
      intents: [
        <Button action="/index">
            what is this?
        </Button>,
        <Button action="/commitment">
            commit
        </Button>,
    ],
    });
});

function filterCastsByAuthorFid(casts: Cast[], targetFid:number) {
    return casts.filter(cast => cast.author.fid === targetFid);
  }

sadhanaFrame.frame('/', async (c) => {
    const { frameData, verified } = c
    const { fid } = frameData
    const castHash = c?.frameData?.castId.hash
    const thisCast = fetchCastInformationFromHash(castHash!)
    console.log("this cast is: ", thisCast)
    
    const repliesToCast = await getCastRepliesFromHash(castHash!, fid)
    const filteredCasts = filterCastsByAuthorFid(repliesToCast, fid);
    console.log("the filtered casts are", filteredCasts)
    const ankysInterpretationOfSadhana = await getAnkysInterpretation(filteredCasts)
    console.log(ankysInterpretationOfSadhana)
    return c.res({
      title: 'sadhana',
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
        <div tw="text-8xl">sadhana</div>
        <div tw="mt-5 flex text-3xl">
          commit to do something
          <span
            tw="ml-1"
          >
            and evolve
          </span>
        </div>
      </div>
      ),
      intents: [
        <Button action="/explanation">
            what is this?
        </Button>,
        <Button action="/commitment">
            commit
        </Button>,
    ],
    });
});

sadhanaFrame.frame('/explanation', async (c) => {
    const { sadhanaId } = c.req.param()
    const sadhana = await prisma.sadhana.findUnique({
        where: {
            id: sadhanaId
        }
    })
    return c.res({
        title: 'sadhana',
        image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">sadhana</div>
          <div tw="mt-5 flex text-3xl">
            <p>this is a game</p>
            <p>on which you challenge yourself</p>
            <p>to be consistent</p>
            <p>and if you fail you pay</p>
            <p>to participate, reply to this cast with your commitment</p>
            <p>make it clear: "i will do 50 pushups every day for 10 days, 10000 $degen"</p>
            <p>"i will call my mother every day for 8 days, 8888 $degen"</p>
            <p>you get the point</p>
          </div>
        </div>
        ),
        intents: [
        <Button action="/commitment">
            commit
        </Button>,
      ],
      });
})

sadhanaFrame.frame('/created-sadhana/:sadhanaId', async (c) => {
    const { sadhanaId } = c.req.param()
    const sadhana = await prisma.sadhana.findUnique({
        where: {
            id: sadhanaId
        }
    })
    return c.res({
        title: 'sadhana',
        image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">sadhana</div>
          <div tw="mt-5 flex text-3xl">
            <p>you committed to:</p>
            <p>{sadhana.description}</p>
            <p>for {sadhana.durationInDays} days</p>
            <p>you bet {sadhana.betInDegen} $degen</p>
            <p tw="text-2xl text-red-600 mt-2">are you in?</p>
          </div>
        </div>
        ),
        intents: [
          <Button action={`/accept-sadhana/${sadhana.id}`}>
              LFG
          </Button>,
          <Button action={`/reject-sadhana/${sadhana.id}`}>
              forget it
          </Button>,
      ],
      });
})

sadhanaFrame.frame('/accept-sadhana/:sadhanaId', async (c) => {
    const { sadhanaId } = c.req.param()
    const sadhana = await prisma.sadhana.update({
        where: {
            id: sadhanaId
        },
        data: {
            userAccepted: true
        }
    })
    return c.res({
        title: 'sadhana',
        image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">sadhana</div>
          <div tw="mt-5 flex text-3xl">
            <p>YOU ARE ALL SET</p>
          </div>
        </div>
        ),
        intents: [
          <Button.Link href={`aloja`}>
              share
          </Button.Link>
      ],
      });
})

sadhanaFrame.frame('/reject-sadhana/:sadhanaId', async (c) => {
    const { sadhanaId } = c.req.param()
    const sadhana = await prisma.sadhana.update({
        where: {
            id: sadhanaId
        },
        data: {
            userAccepted: true
        }
    })
    return c.res({
        title: 'sadhana',
        image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">sadhana</div>
          <div tw="mt-5 flex text-3xl">
            <p>are you sure you want to bail out?</p>
          </div>
        </div>
        ),
        intents: [
            <Button action={`/reject-sadhana/${sadhana.id}/confirm`}>
                yes, fuck it
            </Button>,
            <Button action={`/created-sadhana/${sadhana.id}`}>
                no, will do
            </Button>,
      ],
      });
})

sadhanaFrame.frame('/reject-sadhana/:sadhanaId/confirm', async (c) => {
    const { sadhanaId } = c.req.param()
    const sadhana = await prisma.sadhana.update({
        where: {
            id: sadhanaId
        },
        data: {
            userRejected: true
        }
    })
    return c.res({
        title: 'sadhana',
        image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="text-8xl">sadhana</div>
          <div tw="mt-5 flex text-3xl">
            <p>your sadhana was deleted</p>
          </div>
        </div>
        )
      });
})