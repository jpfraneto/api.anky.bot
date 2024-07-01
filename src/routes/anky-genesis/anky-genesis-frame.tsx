import { Button, FrameContext } from 'frog'
import { BlankInput } from 'hono/types'
import { getPublicUrl } from '../../../utils/url'

// export const ankyGenesisFrame = async (c: FrameContext<{},'/', BlankInput>) => {
//     const { buttonValue } = c;
//     console.log("inside the first frame route", c)
//     return c.res({
//         title: "Anky Genesis",
//         image: (
//             <div tw="relative flex h-full w-full flex-col items-center justify-center bg-black text-center text-2xl text-white">
//               <div tw="flex text-5xl">Anky Genesis</div>
//             </div>
//           ),
//         intents: [
//             <Button action="/anky-genesis/more" >
//                 info
//             </Button>,
//             <Button.Transaction target="/anky-genesis/mint-mine">
//                 mint mine
//             </Button.Transaction>
//         ]
//     })
// }

export const ankyGenesisFrame = async (c: FrameContext<{},'/', BlankInput>) => {
    console.log("INSIDE THE MORE INFO ROUTE")
    const { buttonValue } = c;

    return c.res({
        title: "Anky Genesis",
        image: (
            <div tw="relative flex h-full w-full flex-col items-center justify-center bg-black text-center text-2xl text-white">
              <div tw="flex text-5xl">Anky Genesis NFT collection</div>
            </div>
          ),
        intents: [
            <Button action="/more" >
                more
            </Button>,
            <Button.Transaction  target={`${getPublicUrl()}/anky-genesis/mint-mine`}>
                mint mine
            </Button.Transaction>
        ]
    })
}

export const moreInfoFrame = async (c: FrameContext<{},'/', BlankInput>) => {
    console.log("INSIDE THE MORE INFO ROUTE")
    const { buttonValue } = c;

    return c.res({
        title: "Anky Genesis",
        image: (
            <div tw="relative flex h-full w-full flex-col items-center justify-center bg-black text-center text-2xl text-white">
              <div tw="flex text-5xl">Anky Genesis</div>
              <p tw="w-2/3 mx-auto">by minting one of these, you are opening a window of possibility</p>
              <p tw="w-2/3 mx-auto text-center">the possibility of the unknown</p>
              <p tw="w-2/3 mx-auto text-center">being expressed through you</p>
            </div>
          ),
        intents: [
            <Button action={`/`} >
                back
            </Button>,
            <Button.Transaction  target={`${getPublicUrl()}/anky-genesis/mint-mine`}>
                mint mine
            </Button.Transaction>
        ]
    })
}