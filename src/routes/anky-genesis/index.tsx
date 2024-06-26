import { Frog, parseEther } from 'frog'
import { neynarMiddleware } from '../../services/neynar-service';
import { ankyGenesisFrame, moreInfoFrame } from "./anky-genesis-frame"
import { ANKY_GENESIS_ABI } from '../../constants/abi/ANKY_GENESIS_ABI';

export type AnkyGenesisState = {
    minted: false
}

export const app = new Frog<{
    State: AnkyGenesisState;
}>({
    basePath: "/",
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

app.frame("/", ankyGenesisFrame)
app.frame("/more", moreInfoFrame)

app.transaction('/mint-mine', neynarMiddleware, async (c) => {
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