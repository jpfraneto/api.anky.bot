import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { NeynarVariables } from 'frog/middlewares';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import axios from 'axios';

type ZurfState = {
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
  width: 764,
  height: 400,
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

export type ZurfContext<T extends string = '/logic/:castHash'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: ZurfState;
  },
  T,
  {}
>;

export const zurfFrame = new Frog<{
  State: ZurfState;
}>({
  imageOptions,
  initialState: {
    page: 0,
    config: {}
  }
})

export const zurfColor = '#00FFFF';

export function ZurfBackground(user: Author) {
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
      <div tw="font-bold">Ditto</div>
    </div>
  );
}

zurfFrame.get("/v", async (c) => {
  console.log("IN HERE")
  const { limit } = c.req.query();
  const videos = await prisma.zurfVideo.findMany({ })
  console.log("the videos are: ", videos)
  
  return c.json({videos} || {123:456})
})


zurfFrame.get("/v/:id", async (c) => {
  console.log("IN HERsadsadE")
  const { id } = c.req.param();
  console.log("the id is", id)
  const video = await prisma.zurfVideo.findUnique({
    where: {
      id: id
    }
  })  
  return c.json(video || {123:456})
})


zurfFrame.frame('/leaderboard/:id', async (c) => {
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
      title: "anky",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-7xl mb-2">ZURF</span>
          {leaderboard.map((user, i) => {
            return <span tw="mb-2 text-xl">{user.rank}.        @{user.username}...... {user.points} points</span>
          })}
      </div>
    ),
      intents: [
          <Button action={`/video/${id}`}>back</Button>,
          <Button.Link href={`https://www.guarpcast.com/v/${id}`}>🏄🏻‍♂️ zurf</Button.Link>,
      ],
  })
})

// frames.vibez.social/video/${uuid}

zurfFrame.frame('/video/:id', async (c) => {
  const { id } = c.req.param();
  console.log("THE ID IS ", id)
  console.log(`https://res.cloudinary.com/dzpugkpuz/image/upload/v1720117102/zurf/farcaster_gifs/${id}.gif`)
  return c.res({
      title: "anky",
      image: `https://res.cloudinary.com/dzpugkpuz/image/upload/v1720117102/zurf/farcaster_gifs/${id}.gif`,
      intents: [
          <Button action={`/leaderboard/${id}`}>leaderboard</Button>,
          <Button.Link href={`https://www.guarpcast.com/v/${id}`}>🏄🏻‍♂️ zurf</Button.Link>,
        ],
  })
})

