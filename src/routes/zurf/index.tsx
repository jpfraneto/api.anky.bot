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
  basePath: '/',
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
  initialState : {
    castHash: ""
  }
})

// cast action trigger that displays the frame
zurfFrame.castAction(
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
    { name: "zurf", icon: "log" }
  );

  zurfFrame.frame('/:id', async (c) => {
    const { id } = c.req.param();

    const randomFid = Math.floor(750000*Math.random())
    const options = {
      method: 'GET',
      url: `https://api.neynar.com/v2/farcaster/user/bulk?fids=${randomFid}&viewer_fid=16098`,
      headers: {accept: 'application/json', api_key: NEYNAR_API_KEY}
    };
    const responseFromNeynar = await axios.request(options)
    const prismaResponse = await prisma.video.findUnique({
      where: {
        id: id
      }
    })
    console.log("the prisma response is", prismaResponse)
    const user = responseFromNeynar.data.users[0]
    return c.res({
        title: "anky",
        image: (
          <div
          tw="relative flex h-full w-full items-center justify-center text-center text-2xl text-white"
          style={{
            backgroundImage: 'url("https://zurf.social/assets/cover/zurf-cover.png")',
            backgroundSize: "cover",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        >   
              <div tw="w-3/4 h-full pt-48 pl-48 flex">
                <div tw="w-full h-1/5 flex text-8xl">
                  <div tw="w-96 h-96 flex rounded rounded-full overflow-hidden">
                  <img
                      src={user.pfp_url}
                      width="100%"
                      height="100%"
                    />
                  </div>
                  <div tw="pl-8 w-4/5 h-1/5 flex flex-col">
                      <p>@{user.username}</p>
                      <p>entrepreneurship</p>
                  </div>      
                </div>
              </div>
              <div tw="w-1/4 h-full pt-24 pr-48 flex">
              <img
                      src="https://github.com/jpfraneto/images/blob/main/drakula.png?raw=true"
                      width="100%"
                      height="100%"
                    />
              </div>

          </div>
        ),
        intents: [
            <Button action={`/${prismaResponse?.id}`}>next creator</Button>,
          ],
    })
})

zurfFrame.frame('/generic-reply/:castToReplyHash', async (c) => {
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

zurfFrame.frame('/submit-reply-triade/:goodReplyHash', async (c) => {
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

zurfFrame.frame('/check-user-stats/:actionedCastHash', async (c) => {
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

zurfFrame.frame('/check-my-stats/:actionedCastHash', async (c) => {
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