import { Button, Frog, TextInput } from 'frog'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import axios from 'axios';

export type ZurfFrameState = {
  castHash: ""
}

export const zurfFrame = new Frog<{
  State: ZurfFrameState;
}>({
  imageOptions: {
      width: 2292,
      height: 1200,
      fonts: [
          {
              name: "Righteous",
              source: "google"
          }
      ]
  },
})

zurfFrame.frame('/wtf/:id', async (c) => {
  const { id } = c.req.param();
  return c.res({
      title: "anky",
      image: (
        <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
        <div tw="mt-10 flex text-4xl text-white">
          hello ser
        </div>
        <div tw="mt-10 flex text-4xl text-white">
          we all know curiosity is a gift
        </div>
        <div tw="p-8 flex flex-col rounded-xl border-white bg-purple-600">
          <div tw="mt-10 flex text-xl text-white">
            and trust is earned
          </div>
          <div tw="mt-10 flex text-xl text-white">
            through the power of consistency
          </div>
        </div>
        <div tw="mt-20 flex text-4xl text-gray-500">
          Made with ❤️ by <span tw="ml-2 text-white">zurf</span>
        </div>
      </div>
    ),
      intents: [
          <Button.Link href={`https://api.anky.bot/videos/${id}.mov`}>ver en zurf</Button.Link>,
      ],
  })
})

zurfFrame.frame('/video/:id', async (c) => {
  const { id } = c.req.param();
  return c.res({
      title: "anky",
      image: `https://api.anky.bot/gifs_farcaster/${id}_farcaster.gif`,
      intents: [
          <Button action={`/wtf/${id}`}>wtf is zurf?</Button>,
          <Button.Link href={`https://api.anky.bot/videos/${id}.mov`}>ver en zurf</Button.Link>,
        ],
  })
})

