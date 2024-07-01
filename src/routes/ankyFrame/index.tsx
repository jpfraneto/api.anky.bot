import { Button, Frog, TextInput } from 'frog'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { getStartOfDay } from '../../../utils/time';

export type AnkyFrameState = {
  castHash: ""
}

export const ankyFrames = new Frog<{
  State: AnkyFrameState;
}>({
  basePath: '/',
  imageAspectRatio: '1:1',
  imageOptions: {
      width: 600,
      height: 600,
      fonts: [
          {
              name: "Righteous",
              source: "google"
          }
      ]
  },
  initialState : {
    castHash: ""
  }
})

// cast action trigger that displays the frame
ankyFrames.castAction(
    "/anky-cast-action",
    (c) => {
      const { actionData } = c;
      const { castId, fid, messageHash, network, timestamp, url } = actionData;
      const actionedCastHash = castId.hash;
      const publicUrl = getPublicUrl()
      return c.res({
        type: "frame",
        path: `${publicUrl}/anky/${actionedCastHash}`,
      });
    },
    { name: "anky", icon: "log" }
  );

ankyFrames.frame('/:actionedCastHash', async (c) => {
    const { actionedCastHash } = c.req.param();
    console.log("the actioned cast hash is", actionedCastHash)
    return c.res({
        title: "anky",
        image: (
            <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
            <div tw="mt-10 flex text-4xl text-white">
              hello ser
            </div>
            <div tw="mt-10 flex text-4xl text-white">
              what do you want to do?
            </div>
            <div tw="p-8 flex flex-col rounded-xl border-white bg-purple-600">
              <div tw="mt-10 flex text-xl text-white">
                cast hash
              </div>
              <div tw="mt-10 flex text-xl text-white">
                {actionedCastHash}
              </div>
            </div>
            <div tw="mt-20 flex text-4xl text-gray-500">
              Made with ❤️ by <span tw="ml-2 text-white">@jpfraneto</span>
            </div>
          </div>
        ),
        intents: [
            <TextInput placeholder="bad reply url/hash" />,
            <Button action={`/generic-reply/${actionedCastHash}`}>generic reply</Button>,
            <Button action={`/submit-reply-triade/${actionedCastHash}`}>add triade</Button>,
            <Button action={`/check-stats/${actionedCastHash}`}>check stats</Button>,
            <Button action={`/check-score/${actionedCastHash}`}>check my score</Button>,
          ],
    })
})

ankyFrames.frame('/generic-reply/:castToReplyHash', async (c) => {
  const { castToReplyHash } = c.req.param();
  if(!castToReplyHash) {
    return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
            hello master
          </div>
          <div tw="mt-10 flex text-4xl text-white">
            what do you want to do?
          </div>
          <div tw="mt-20 flex text-5xl text-gray-500">
            Made with ❤️ by <span tw="ml-2 text-white">@jpfraneto</span>
          </div>
        </div>
      ),
    })
  } else {
    const response = await replyToThisCastThroughChatGtp(castToReplyHash)
    console.log('the reponse to casting was', response)
    return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
            i replied to this cast, and it was saved. did you?
          </div>
        </div>
      ),
    })
  }

})

ankyFrames.frame('/submit-reply-triade/:goodReplyHash', async (c) => {
  const { goodReplyHash } = c.req.param();
  const validInputRegex = /^(https:\/\/warpcast\.com\/[a-zA-Z0-9_]+\/0x[a-fA-F0-9]{8}|0x[a-fA-F0-9]{40})$/;;
  let isValidText = false;
  if(c.inputText) {
     isValidText = validInputRegex.test(c.inputText)
  }
  if(!c.inputText || !isValidText) {
    return c.res({
      title: "anky",
      image: (
          <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
            you didnt provide a valid cast hash for storing it on the database
          </div>
          <div tw="p-8 flex flex-col rounded-xl border-white bg-purple-600">
            <div tw="mt-10 flex text-xl text-white">
              cast hash
            </div>
            <div tw="mt-10 flex text-xl text-white">
              {goodReplyHash}
            </div>
          </div>
          <div tw="mt-20 flex text-4xl text-gray-500">
            Made with ❤️ by <span tw="ml-2 text-white">@jpfraneto</span>
          </div>
        </div>
      ),
      intents: [
          <TextInput placeholder="bad reply url/hash" />,
          <Button action={`/submit-reply-triade/${goodReplyHash}`}>add triade</Button>,
        ],
    })
  } else {
      const { goodReplyHash } = c.req.param();
      const goodReplyCast = await fetchCastInformationFromHash(goodReplyHash)
      console.log('the good reply cast is: ', goodReplyCast)
      const parentCast = await fetchCastInformationFromHash(goodReplyCast?.parent_hash)
      const badReplyLink = c.inputText || "";
      const badReplyCast = await fetchCastInformationFromUrl(badReplyLink)
      const userFid = c?.frameData?.fid || 16098;
      const response = await saveCastTriadeOnDatabase(parentCast, goodReplyCast, badReplyCast, userFid);
      let thisDay = getStartOfDay(new Date().getTime())
      const repliesThatHaveBeenSavedToday = await prisma.replyForTrainingAnky.count({
        where: {
          dayOfStorage: Number(thisDay)
        }
      })
      console.log("the response after saving the cast triade is: ", repliesThatHaveBeenSavedToday)
      return c.res({
          title: "save this reply",
          image: (
              <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
              <div tw="mt-10 flex text-4xl text-white">
                  reply stored
              </div>
              <div tw="mt-10 flex text-4xl text-white">
                  88 replies have been stored today
              </div>
              </div>
          ),
      })
  }
})

ankyFrames.frame('/check-stats/:actionedCastHash', async (c) => {
  const { actionedCastHash } = c.req.param();
  return c.res({
    title: "anky",
    image: (
        <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
        <div tw="mt-10 flex text-4xl text-white">
          your stats are
        </div>
      </div>
    ),
    intents: [
      <Button action={`/${actionedCastHash}`}>back</Button>,

      ],
  })
})

ankyFrames.frame('/check-score/:actionedCastHash', async (c) => {
  const { actionedCastHash } = c.req.param();
  return c.res({
    title: "anky",
    image: (
        <div tw="flex h-full w-full flex-col px-16 items-center justify-center bg-black text-white">
        <div tw="mt-10 flex text-4xl text-white">
          your score is
        </div>
      </div>
    ),
    intents: [
      <Button action={`/${actionedCastHash}`}>back</Button>,
      ],
  })
})