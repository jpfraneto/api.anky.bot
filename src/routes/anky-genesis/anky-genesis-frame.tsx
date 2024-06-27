import { Button, FrameContext } from 'frog'
import { BlankInput } from 'hono/types'
import { getPublicUrl } from '../../../utils/url'

export const ankyGenesisFrame = async (c: FrameContext<{},'/', BlankInput>) => {
    const { buttonValue } = c;
    console.log("inside the first frame route", c)
    return c.res({
        title: "Anky Genesis",
        image: "https://github.com/jpfraneto/images/blob/main/ankkky.png?raw=true",
        intents: [
            <Button action={`${getPublicUrl()}/anky-genesis/more`} >
                info
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
        action: `${getPublicUrl()}/anky-genesis/minted`,
        image: (
            <div tw="relative flex h-full w-full flex-col items-center justify-center bg-black text-center text-2xl text-white">
              <div tw="flex text-5xl">🪙 Tip Token Holders</div>
              <div tw="flex flex-col items-center justify-center">
                <div tw="my-5 flex">
                  <span tw="text-yellow-300">chainId</span>,
                  <span tw="text-orange-500">tokenAddress</span>,
                  <span tw="text-green-500">amount</span>,
                  <span tw="text-blue-500">tokenId (optional for ERC1155)</span>
                </div>
                <span tw="text-blue-500">
                  pro tip: leave it empty for checking ALL ERC1155 token ids
                </span>
              </div>
              <div tw="my-5 flex h-[2px] w-full bg-gray-500" />
              <div tw="text-2xl">Examples</div>
              <div tw="mt-5 flex border border-white px-2 py-1">
                holding <span tw="mx-1 flex text-green-500">10</span>{' '}
                <span tw="text-orange-500">PaidGroup#1</span>
                (ERC1155) on <span tw="mx-1 flex text-yellow-300">Base chain</span>
              </div>
              <div tw="flex">
                <span tw="text-yellow-300">8453</span>,
                <span tw="text-orange-500">
                  0xeC5461Aa3A8CAC1095B04D00aC7cAbAB87A2a7Ec
                </span>
                ,<span tw="text-green-500">10</span>,<span tw="text-blue-500">1</span>
              </div>
      
              <div tw="mt-5 flex border border-white px-2 py-1">
                holding <span tw="mx-1 flex text-green-500">1</span>{' '}
                <span tw="text-orange-500">MFER</span> (ERC721) on{' '}
                <span tw="mx-1 flex text-yellow-300">Mainnet</span>
              </div>
              <div tw="flex">
                <span tw="text-yellow-300">1</span>,
                <span tw="text-orange-500">
                  0x79FCDEF22feeD20eDDacbB2587640e45491b757f
                </span>
                ,<span tw="text-green-500">1</span>
              </div>
      
              <div tw="mt-5 flex border border-white px-2 py-1">
                holding <span tw="mx-1 flex text-green-500">1,000</span>{' '}
                <span tw="text-orange-500">SENDIT</span>
                (ERC20) on <span tw="mx-1 flex text-yellow-300">Base chain</span>
              </div>
              <div tw="flex">
                <span tw="text-yellow-300">8453</span>,
                <span tw="text-orange-500">
                  0xba5b9b2d2d06a9021eb3190ea5fb0e02160839a4
                </span>
                ,<span tw="text-green-500">1000</span>
              </div>
            </div>
          ),
        intents: [
            <Button action={`${getPublicUrl()}/anky-genesis`} >
                back
            </Button>,
            <Button.Transaction  target={`${getPublicUrl()}/anky-genesis/mint-mine`}>
                mint mine
            </Button.Transaction>
        ]
    })
}