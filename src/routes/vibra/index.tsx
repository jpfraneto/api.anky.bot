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
      username: "guty",
      titleOfTheLivestream: "Semifinal Eurocopa",
      durationSoFar: 45
  },
  {
      username: "ChefAlexDelicious",
      titleOfTheLivestream: "Cooking with Chef Alex",
      durationSoFar: 30
  },
  {
      username: "CodeMaster42",
      titleOfTheLivestream: "Live Coding Session",
      durationSoFar: 60
  },
  {
      username: "YogaWithLuna",
      titleOfTheLivestream: "Daily Yoga Routine",
      durationSoFar: 50
  },
  {
      username: "GuitarGuruSam",
      titleOfTheLivestream: "Guitar Lessons for Beginners",
      durationSoFar: 20
  },
  {
      username: "ArtLoverEmily",
      titleOfTheLivestream: "Virtual Art Gallery Tour",
      durationSoFar: 75
  },
  {
      username: "GamerPro77",
      titleOfTheLivestream: "Gaming Marathon",
      durationSoFar: 90
  },
  {
      username: "PhotoWizardMike",
      titleOfTheLivestream: "Photography Tips & Tricks",
      durationSoFar: 25
  },
  {
      username: "FitLifeAnna",
      titleOfTheLivestream: "Fitness Bootcamp",
      durationSoFar: 40
  },
  {
      username: "DIYKingJohn",
      titleOfTheLivestream: "DIY Home Projects",
      durationSoFar: 35
  },
  {
      username: "ZenMasterKai",
      titleOfTheLivestream: "Meditation and Mindfulness",
      durationSoFar: 55
  },
  {
      username: "TravelQueenEmma",
      titleOfTheLivestream: "Travel Vlog: Paris",
      durationSoFar: 80
  }
];



vibraFrame.frame('/', async (c) => {
  return c.res({
    title: 'onda.so',
    image: 'https://github.com/jpfraneto/images/blob/main/guty.png?raw=true',
    intents: [
      <Button action="/index">
        more livestreams
      </Button>,
      <Button.Link href="https://3061541.cargo.site/">go to stream</Button.Link>,
  ],
  });
});

vibraFrame.frame('/index', async (c) => {
  return c.res({
      title: "onda.so",
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
      title: "onda.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">RELEASE THE BRAINZ</span>
          <span tw="text-purple-500 text-2xl mb-2">QUE VENGA LA BUENA VIBRA</span>
          <span tw="text-yellow-500 text-4xl mb-2">stream. be yourself.</span>
      </div>
    ),
      intents: [
          <Button action={`/index`}>livestreams list</Button>,
          <Button.Link href={`https://3061541.cargo.site/`}>create my stream</Button.Link>,
      ],
  })
})

vibraFrame.frame('/more-info/:fid', async (c) => {
  const { deriveState, inputText, buttonValue } = c;
  const { fid } = c.req.param();
  const livestreamIndex = Number(inputText)
  if (livestreamIndex > 0 && livestreamIndex < 13) {
    const chosenLivestream = livestreams[livestreamIndex - 1]
    return c.res({
      title: "onda.so",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-4xl mb-2">{chosenLivestream.titleOfTheLivestream}</span>
          <span tw="text-purple-200 text-3xl mb-2">@{chosenLivestream.username}</span>
          <span tw="text-purple-200 text-2xl mb-2">duration so far: {chosenLivestream.durationSoFar}</span>
          <span tw="text-purple-200 text-2xl mb-2">viewers: 69</span>
      </div>
    ),
      intents: [
          <Button action={`/index`}>back</Button>,
          <Button.Link href="https://3061541.cargo.site/">go to stream</Button.Link>,
      ],
  })
  } else {
    return c.res({
      title: "onda.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">active livestreams</span>
          {livestreams.map((x,i) => {
            return <p tw="text-left text-xl text-purple-300 mb-1">{i + 1}. {x.titleOfTheLivestream.toLowerCase()} - {x.username}</p>
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
  })
  }

})


vibraFrame.get("/v", async (c) => {
  console.log("IN HERE")
  const { limit } = c.req.query();
  const videos = await prisma.zurfVideo.findMany({ })
  console.log("the videos are: ", videos)
  
  return c.json({videos} || {123:456})
})


vibraFrame.get("/v/:id", async (c) => {
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
      title: "anky",
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
          <Button.Link href={`https://vibra-so.vercel.app`}>vibra</Button.Link>,
      ],
  })
})


vibraFrame.frame('/video/:id', async (c) => {
  let { id } = c.req.param();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  id = "cecc074e-ae72-4f17-a4e6-553b23e04f00"
  if (uuidRegex.test(id)) {
    return c.res({
      title: "anky",
      image: `https://storage.googleapis.com/zurf-app-lens/${id}-gif`,
      intents: [
        <Button action={`/leaderboard/${id}`}>leaderboard</Button>,
        <Button.Link href={`https://www.guarpcast.com?v=${id}`}>see video</Button.Link>,
      ],
    });
  } else {
    return c.res({
      title: "anky",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center py-8 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-7xl mb-2">vibra</span>
          <span tw="text-yellow-500 text-4xl mb-2">this video was not found</span>
        </div>
      ),
      intents: [
        <Button action={`/`}>back</Button>,
        <Button.Link href={`https://www.guarpcast.com/v/${id}`}>record new</Button.Link>,
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
          <Button.Link href={`https://www.guarpcast.com/v`}>🏄🏻‍♂️ zurf</Button.Link>,
        ],
  })
})

vibraFrame.frame('/landing', async (c) => {
  console.log("inside the landing", c?.buttonValue)
  return c.res({
      title: "anky",
      image: `https://res.cloudinary.com/dzpugkpuz/image/upload/v1720556901/output_y10821.gif`,
      intents: [
          <Button action={`/leaderboard/123`}>leaderboard</Button>,
          <Button.Link href={`https://vibra-so.vercel.app/`}>vibra</Button.Link>,
        ],
  })
})


