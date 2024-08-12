/** @jsxImportSource frog/jsx */
import { Frog, Button } from 'frog';
import { Logger } from '../../../utils/Logger';
import { colors } from '../../constants/colors';

export const app = new Frog({
  imageAspectRatio: '1:1',
  imageOptions: {
    width: 600,
    height: 600,
    fonts: [
      {
        name: 'Righteous',
        source: 'google',
      },
    ],
  },
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});

app.frame('/', async (c) => {
  return c.res({
    title: 'Anky Genesis',
    image: (
      <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
        <div tw="text-8xl">vibra</div>
        <div tw="mt-5 flex text-3xl">
          Made with ❤️ by{' '}
          <span
            tw="ml-1"
            style={{
              color: colors.warpcast,
            }}
          >
            @jpfraneto
          </span>
        </div>
      </div>
    ),
    imageOptions: {
      ...app.imageOptions,
      width: 600,
      height: 600,
    },
    imageAspectRatio: '1:1',
    intents: [
      <Button.Link href="https://warpcast.com/vibraso.eth">
        @vibraso.eth
      </Button.Link>,
      <Button action="/frames">
        frames
      </Button>,
  ],
  });
});


app.frame('/frames', async (c) => {
  console.log("INSIDE THE FRAMES ROUTE FOR THIS ONE")
  return c.res({
    title: 'anky',
    image: (
      <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-3xl text-white">
        <div tw="text-5xl">frramess</div>
        <div
          tw="mt-10 flex flex-col"
          style={{
            gap: 20,
          }}
        >
          <div tw="flex flex-col items-center">
            <div
              tw="text-3xl"
              style={{
                color: colors.warpcast,
              }}
            >
              pronto
            </div>
          </div>
        </div>
      </div>
    ),
    intents: [<Button action="/">Back</Button>, 
    <Button action="/">1</Button>, 
    <Button action="/">2</Button>,
    <Button action="/">3</Button>],
  });
});
