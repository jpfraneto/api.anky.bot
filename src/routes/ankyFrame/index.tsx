import { Button, Frog, TextInput } from 'frog'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';

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
      intents: [
        <TextInput placeholder="bad reply url/hash" />,
        <Button action={`/generic-reply/${castToReplyHash}`}>generic reply</Button>,
        <Button action={`/submit-reply-triade/${castToReplyHash}`}>add triade</Button>,
        <Button action={`/check-user-stats/${castToReplyHash}`}>check user stats</Button>,
        <Button action={`/check-my-stats/${castToReplyHash}`}>check my stats</Button>,
      ],
    })
  } else {
    const response = await replyToThisCastThroughChatGtp(castToReplyHash)
    console.log('the reponse to casting dummyily was', response)
    const { hash, author, text } = response;
    return c.res({
      title: "anky",
      image: (
        <div tw="flex h-full w-full flex-col items-center justify-center bg-[#16101F] text-white p-5" style={{ fontFamily: 'Roboto' }}>
          <div tw="flex w-full items-start">
            <div tw="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
              {author.display_name.charAt(0).toUpperCase()}
            </div>
            <div tw="ml-5 flex flex-col">
              <div tw="text-xl font-bold">{author.display_name}</div>
              <div tw="text-sm text-gray-400">@{author.username}</div>
            </div>
          </div>
          <div tw="mt-5 text-2xl w-full" style={{ wordBreak: 'break-word' }}>
            {text}
          </div>
          <div tw="mt-10 flex w-full items-center justify-between">
            <div tw="flex items-center">
              <div tw="mr-2 text-gray-400">Cast hash:</div>
              <div tw="text-[#7B66C1]">{abbreviateAddress(hash)}</div>
            </div>
            <div tw="flex h-12 w-20 items-center justify-center rounded-lg bg-[#7B66C1] text-xl font-bold">
              Reply
            </div>
          </div>
        </div>
      ),
      intents: [
        <Button.Link href={`https://www.warpcast.com/${author.username}/${hash.slice(0,10)}`}>View Original Cast</Button.Link>,
      ],
    });
  }

})

ankyFrames.frame('/submit-reply-triade/:goodReplyHash', async (c) => {
  const { goodReplyHash } = c.req.param();
  const validInputRegex = /^(https:\/\/warpcast\.com\/[a-zA-Z0-9_]+\/0x[a-fA-F0-9]{6}|0x[a-fA-F0-9]{40})$/;
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
      if(goodReplyCast.parent_hash == null) {
        return c.res({
          title: "save this reply",
          image: (
              <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
              <div tw="mt-10 flex text-4xl text-white">
                  NOT VALID
              </div>
              <div tw="mt-10 flex text-4xl text-white">
                  you need to call this cast action on a GOOD REPLY. you called it on a root cast
              </div>
              </div>
          ),
      })
      }
      const parentCast = await fetchCastInformationFromHash(goodReplyCast?.parent_hash)
      const badReplyLink = c.inputText || "";
      let badReplyCast;
      if ( badReplyLink.includes("warpcast") ) {
        badReplyCast = await fetchCastInformationFromUrl(badReplyLink)
      } else {
        badReplyCast = await fetchCastInformationFromHash(badReplyLink)
      }
      const userFid = c?.frameData?.fid || 16098;
      await saveCastTriadeOnDatabase(parentCast, goodReplyCast, badReplyCast, userFid);
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
                  {repliesThatHaveBeenSavedToday} replies have been stored today
              </div>
              </div>
          ),
      })
  }
})

ankyFrames.frame('/check-user-stats/:actionedCastHash', async (c) => {
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

ankyFrames.frame('/check-my-stats/:actionedCastHash', async (c) => {
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