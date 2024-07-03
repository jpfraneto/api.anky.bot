import { Frog, parseEther } from 'frog'
import { Button, FrameContext } from 'frog'
import { BlankInput } from 'hono/types'
import { neynarMiddleware } from '../../services/neynar-service';
import { ankyGenesisFrame, moreInfoFrame } from "./anky-genesis-frame"
import { getPublicUrl } from '../../../utils/url';
import { ANKY_GENESIS_ABI } from '../../constants/abi/ANKY_GENESIS_ABI';

export type AnkyGenesisState = {
    minted: false
}

const publicUrl = getPublicUrl() ;
console.log("The publiccccccc url is: ", publicUrl)

export const ankyGenesis = new Frog<{
    State: AnkyGenesisState;
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
        minted: false
    }
})

ankyGenesis.frame("/", ankyGenesisFrame)
ankyGenesis.frame("/more", moreInfoFrame)

ankyGenesis.transaction('/mint-mine', neynarMiddleware, async (c) => {
    console.log('inside the mint mine route')
    return c.contract({
        abi: ANKY_GENESIS_ABI,
        to: "0x5806485215c8542c448ecf707ab6321b948cab90",
        chainId: 'eip155:1',
        attribution: false,
        functionName: 'mint',
        value: parseEther("0.01618"),
      });
})