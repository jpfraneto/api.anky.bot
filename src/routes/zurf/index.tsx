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
    console.log("the user is: ", user)
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
            <Button action='/'>wtf is zurf?</Button>,
            <Button.Link href={`https://video.anky.bot/${id}`}>see on zurf</Button.Link>,
          ],
    })
})