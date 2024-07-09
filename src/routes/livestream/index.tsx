import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { NeynarVariables } from 'frog/middlewares';
import { abbreviateAddress } from '../../../utils/strings';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import axios from 'axios';

type VibezState = {
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

export type VibezContext<T extends string = '/'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: VibezState;
  },
  T,
  {}
>;

export const livestreamFrame = new Frog<{
  State: VibezState;
}>({
  imageAspectRatio: '1:1',
  imageOptions,
  initialState: {
    page: 0,
    config: {}
  }
})

export const vibezColor = '#00FFFF';

export function VibezBackground(user: Author) {
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
      <div tw="font-bold">zurf</div>
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



livestreamFrame.frame('/', async (c) => {
  return c.res({
    title: 'onda.so',
    image: 'https://github.com/jpfraneto/images/blob/main/guty.png?raw=true',
    intents: [
      <Button action="/index">
        more livestreams
      </Button>,
      <Button.Link href="https://zurf.social/stream/gutybv">go to stream</Button.Link>,
  ],
  });
});

livestreamFrame.frame('/index', async (c) => {
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
          <Button action={`/what-is-vibez`}>vibez?</Button>,
      ],
  })
})

livestreamFrame.frame('/what-is-vibez', async (c) => {
  return c.res({
      title: "onda.so",
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">NO MORE BRAINZ</span>
          <span tw="text-purple-500 text-2xl mb-2">BRING ON THE VIBEZ</span>
          <span tw="text-yellow-500 text-4xl mb-2">stream. be yourself.</span>
      </div>
    ),
      intents: [
          <Button action={`/index`}>livestreams list</Button>,
          <Button.Link href={`https://www.surf.social`}>create my stream</Button.Link>,
      ],
  })
})

livestreamFrame.frame('/more-info/:fid', async (c) => {
  const { deriveState, inputText, buttonValue } = c;
  const { fid } = c.req.param();
  console.log("the input text is: ", inputText)
  const livestreamIndex = Number(inputText)
  if (livestreamIndex < 13) {
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
          <Button action={`/video`}>back</Button>,
          <Button.Link href="https://zurf.social/stream/gutybv">go to stream</Button.Link>,
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
      ],
  })
  }

})
