import { Button, Frog, TextInput } from 'frog'
import { getPublicUrl } from '../../../utils/url';
import ky from 'ky';
import {
    neynarClient,
    neynarMiddleware,
  } from '../../services/neynar-service';

export const app = new Frog<{
    State: {
        rootReplyHash: string,
        goodReplyHash: string,
        badReplyHash: string
    };
}>({
    initialState: {
        rootReplyHash: '',
        goodReplyHash: '',
        badReplyHash: ''
    }
})

app.hono.get('/frame', async (c) => {
    const html = (await ky(`${getPublicUrl()}/save-reply-triade`)).text();
    return c.html(html)
})

// cast action trigger that displays the frame
app.castAction(
    "/save-this-reply-action",
    (c) => {
      const { actionData } = c;
      const { castId, fid, messageHash, network, timestamp, url } = actionData;
      const goodReplyHash = castId.hash;
      return c.res({
        type: "frame",
        path: `https://api.anky.bot/save-reply-triade/${goodReplyHash}`,
      });
    },
    { name: "save this reply", icon: "log" }
  );

app.frame('/:goodReplyHash', async (c) => {
    const { goodReplyHash } = c.req.param();
    return c.res({
        title: "save this reply",
        image: (
            <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
            <div tw="mt-10 flex text-4xl text-white">
              Store this reply
            </div>
            <div tw="mt-10 flex text-4xl text-white">
              you called this cast action on a GOOD reply. now enter the url or hash of a bad one
            </div>
            <div tw="mt-20 flex text-5xl text-gray-500">
              Made with ❤️ by <span tw="ml-2 text-white">@jpfraneto</span>
            </div>
          </div>
        ),
        intents: [
            <TextInput placeholder="BAD ONE: url or hash" />,
            <Button action={`/save-bad-reply/${goodReplyHash}`}>next</Button>,
          ],
    })
})

app.frame('/save-bad-reply/:goodReplyHash', async (c) => {
    const { goodReplyHash } = c.req.param();
    const goodReplyCast = await fetchCastFromHash(goodReplyHash)
    const rootCast = await fetchCastFromHash(goodReplyCast?.hash)
    const badReplyLink = c.inputText || "";
    const badCast = await fetchCastFromLink(badReplyLink)
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
})

async function fetchCastFromHash (castHash:string) {
    return {hash: "89uasd89s8d"}
}

async function fetchCastFromLink(castLink:string) {
    return {hash: "89uasd89s8d"}
}