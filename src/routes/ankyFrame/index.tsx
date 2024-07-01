import { Button, Frog, TextInput } from 'frog'
import { getPublicUrl } from '../../../utils/url';
import ky from 'ky';
import {
    neynarClient,
    neynarMiddleware,
  } from '../../services/neynar-service';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl } from '../../../utils/cast';

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
  console.log("INSIDE THE GENERIC REPLY ROUTE")
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
  console.log("INSIDE THE SUBMIT REPLY TRIADE")
    if(!c.inputText) {
      return c.res({
      title: "save this reply",
      image: (
          <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div tw="mt-10 flex text-4xl text-white">
              no input provided
          </div>
          </div>
      ),
    })} else {
      const { goodReplyHash } = c.req.param();
      const goodReplyCast = await fetchCastInformationFromHash(goodReplyHash)
      console.log('the good reply cast is: ', goodReplyCast)
      const rootCast = await fetchCastInformationFromHash(goodReplyCast?.parent)
      const badReplyLink = c.inputText || "";
      const badCast = await fetchCastInformationFromUrl(badReplyLink)
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