import { Button, FrameContext, Frog, TextInput } from 'frog';
import { Author } from '../../../utils/types/cast'
import { getPublicUrl } from '../../../utils/url';
import { replyToThisCastThroughChatGtp } from '../../../utils/anky';
import { fetchCastInformationFromHash, fetchCastInformationFromUrl, saveCastTriadeOnDatabase } from '../../../utils/cast';
import prisma from '../../../utils/prismaClient';
import { neynar, NeynarVariables } from 'frog/middlewares';
import { getStartOfDay } from '../../../utils/time';
import { abbreviateAddress } from '../../../utils/strings';
import axios from 'axios';
import { Logger } from '../../../utils/Logger';
import { neynarClient } from '../../services/neynar-service';
import { NEYNAR_API_KEY } from '../../../env/server-env';
import { getUserFromFid } from '../../../utils/farcaster';
import queryString from 'query-string';
import {
  createPublicClient,
  erc20Abi,
  erc721Abi,
  getAddress,
  http,
} from 'viem';
import * as chains from 'viem/chains';
import { ALCHEMY_INSTANCES, getTransport } from '../../../utils/web3';
import { HYPERSUB_ABI } from '../../constants/abi/HYPERSUB_ABI';
import { MOXIE_PASS_ABI } from '../../constants/abi/MOXIE_PASS_ABI';


export function getViemChain(chainId: number) {
  const found = Object.values(chains).find((chain) => chain.id === chainId);
  if (!found) {
    throw new Error(`Chain with id ${chainId} not found`);
  }

  return found;
}


const chainId = 8453
const chain = getViemChain(Number(chainId));

const publicClient = createPublicClient({
chain,
transport: getTransport(chainId),
});

type VibraState = {
  // profiles
  page?: number;
  config: {
    fid?: number;
    pfp_url?: string;
    username?: string;
    points?: number;
    rank?: number;
  };
};

const imageOptions = {
  width: 600,
  height: 600,
  fonts: [
    {
      name: 'Poetsen One',
      source: 'google',
    },
    {
      name: 'Roboto',
      source: 'google',
    },
  ] as any,
};

export type VibraContext<T extends string = '/logic/:castHash'> = FrameContext<
  {
    Variables: NeynarVariables;
    State: VibraState;
  },
  T,
  {}
>;

export const tvFrame = new Frog<{
  State: VibraState;
}>({
  imageOptions,
  imageAspectRatio: "1:1",
  initialState: {
    page: 0,
    config: {}
  }
})

tvFrame.use(async (c, next) => {
  Logger.info(`[${c.req.method}] : : :  ${c.req.url}`);
  c.res.headers.set('Cache-Control', 'max-age=0');
  await next();
});

tvFrame.frame('/', async (c) => {
  let imageUrl = "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720814025/agprlpuqgvpblbgfsljy.gif"
  return c.res({
    title: 'vibra.so',
    image: imageUrl,
    intents: [
      <Button action={`/maretus.eth/1`}>@maretus.eth</Button>,
      <Button action={`/kevinmfer/1`}>@kevinmfer</Button>
    ],
  });
});

const channels = {
  "maretus.eth": [
    {
        "hash": "0xe224b371e5ad734d29cb339a621fb510c0255c97",
        "timestamp": "2024-07-14T01:09:28.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/ccdd4de4ed06c5463617c8ba7b479d82.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924943/0xe224b371e5ad734d29cb339a621fb510c0255c97.gif"
    },
    {
        "hash": "0xa0903f418659b43602bba679dbaaacb661530e07",
        "timestamp": "2024-07-13T23:48:25.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/dbb42e999de6b96e26f83060839caab9.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924944/0xa0903f418659b43602bba679dbaaacb661530e07.gif"
    },
    {
        "hash": "0x225365fdf783642ff5e0ad4ae26ba825de66f89d",
        "timestamp": "2024-07-13T16:16:42.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/fad245a39ead3b5981c1d2892957e433.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924945/0x225365fdf783642ff5e0ad4ae26ba825de66f89d.gif"
    },
    {
        "hash": "0x80d6b1b734d95c00c9dc94f9e2334ff7520a622c",
        "timestamp": "2024-07-13T00:46:17.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/4abaad873112c0424fcbae22bec82a4d.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924947/0x80d6b1b734d95c00c9dc94f9e2334ff7520a622c.gif"
    },
    {
        "hash": "0x59f2855759996b3c8efc93399b1fd674ed70f7b0",
        "timestamp": "2024-07-12T20:04:40.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/bf3c1e7c88f986f85ab155532677815b.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924948/0x59f2855759996b3c8efc93399b1fd674ed70f7b0.gif"
    },
    {
        "hash": "0x03ebaddd46f73a0cc6020172fd0f48113b31c955",
        "timestamp": "2024-07-12T15:10:50.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/acdd170d3741c23724391cf61fc89934.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924949/0x03ebaddd46f73a0cc6020172fd0f48113b31c955.gif"
    },
    {
        "hash": "0x33712daa278d1c511459b39d1b3fa98315b9006c",
        "timestamp": "2024-07-11T18:57:59.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/e39e5eee9ee5c178d9ee8cb916042233.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924951/0x33712daa278d1c511459b39d1b3fa98315b9006c.gif"
    },
    {
        "hash": "0xe5bcdaf84e88b5a4aff65c7b9e49a9336857b511",
        "timestamp": "2024-07-11T18:11:44.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/3be34eb5986eb371616618cbb7882089.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924953/0xe5bcdaf84e88b5a4aff65c7b9e49a9336857b511.gif"
    },
    {
        "hash": "0x94f812172b2a3b10382a8c89cab78763ea417ce8",
        "timestamp": "2024-07-11T17:39:34.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/12c7726c5826f93a6dd73a81a8591248.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924954/0x94f812172b2a3b10382a8c89cab78763ea417ce8.gif"
    },
    {
        "hash": "0x921cf39a2d1b5add6ee39eae01c810c6865df7c6",
        "timestamp": "2024-07-11T14:06:19.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/0c9512289f7d02524b73bbbb293d9bc9.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924955/0x921cf39a2d1b5add6ee39eae01c810c6865df7c6.gif"
    },
    {
        "hash": "0xefeb5a173197c4b4ce5b0c25493a5020973a9cc1",
        "timestamp": "2024-07-11T12:55:29.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/1b0d0943be7608a5552ef4dec3ce98a1.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924957/0xefeb5a173197c4b4ce5b0c25493a5020973a9cc1.gif"
    },
    {
        "hash": "0x86e22186cba6b0d11cd7a27aee9af6c18495a43d",
        "timestamp": "2024-07-10T16:11:46.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/0e5e29eade4f622487e9cd5e69d86e9e.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924958/0x86e22186cba6b0d11cd7a27aee9af6c18495a43d.gif"
    },
    {
        "hash": "0x80ac23f353f400cff59dbb8f3d5da0dcc384eccb",
        "timestamp": "2024-07-10T15:16:08.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/82b9061d32142ca6f0ca3a8259ecfe70.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924960/0x80ac23f353f400cff59dbb8f3d5da0dcc384eccb.gif"
    }
], 
  "kevinmfer" : [
    {
        "hash": "0x7c1a9f14c78ad9aa0fb6476b32a581a7f8374ac5",
        "timestamp": "2024-07-13T14:26:09.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/0bf904d03affb96d11e72a8c468ec5c7.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924992/0x7c1a9f14c78ad9aa0fb6476b32a581a7f8374ac5.gif"
    },
    {
        "hash": "0x234f359c261df5b47e47fa374e74b844e989e04f",
        "timestamp": "2024-07-13T11:40:27.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/0d1d5eae9a51632e9c3b3884ad86d0dd.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924993/0x234f359c261df5b47e47fa374e74b844e989e04f.gif"
    },
    {
        "hash": "0x68ed8e69b6deeab991362cf63e8cd2efd2adce84",
        "timestamp": "2024-07-13T10:05:50.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/ee786d4ab19c096657cce2ed36ba2654.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924994/0x68ed8e69b6deeab991362cf63e8cd2efd2adce84.gif"
    },
    {
        "hash": "0x994cef28db7b7eb95f9da591cbda18c447772b92",
        "timestamp": "2024-07-13T07:50:00.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/cf38805c6c0cc5a67c234a80e25a180b.m3u8"
            },
            {
                "castId": {
                    "fid": 8942,
                    "hash": "0x922bfc1d687bcb03c1f4e5756f3403ed136c1913"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924995/0x994cef28db7b7eb95f9da591cbda18c447772b92.gif"
    },
    {
        "hash": "0xf05048537ffeeb6f114ca8371fa18023efec2e2a",
        "timestamp": "2024-07-12T15:54:42.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/f42047abc33a4407fec5b9cccfcd73f8.m3u8"
            },
            {
                "castId": {
                    "fid": 248216,
                    "hash": "0x601fecd0a81b1167890b274c5bb306dd66111b36"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924996/0xf05048537ffeeb6f114ca8371fa18023efec2e2a.gif"
    },
    {
        "hash": "0x41f89da56ace28de44b28ba72db38a5e36b465d8",
        "timestamp": "2024-07-12T15:44:24.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/67c000a10b0143a7cf1f81651c85eceb.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924997/0x41f89da56ace28de44b28ba72db38a5e36b465d8.gif"
    },
    {
        "hash": "0x6a0a5d1ac0d4802e2fc69a353cf5f2a65fb55d64",
        "timestamp": "2024-07-12T09:39:12.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/cd134c606d801bbe5c9099232ed202e8.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924998/0x6a0a5d1ac0d4802e2fc69a353cf5f2a65fb55d64.gif"
    },
    {
        "hash": "0x7a506c8c713c8a5d215e35b1ff5ccb09c47b6d25",
        "timestamp": "2024-07-11T18:45:25.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/e706e9fab0bf9874b426d54b028ee33f.m3u8"
            },
            {
                "castId": {
                    "fid": 6596,
                    "hash": "0x86afb898661455bc028ac5ca96f98023eadf1a95"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720924999/0x7a506c8c713c8a5d215e35b1ff5ccb09c47b6d25.gif"
    },
    {
        "hash": "0xc3610171279c631a1bbf259a14f6b330cee148c1",
        "timestamp": "2024-07-11T16:51:40.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/929fc9eb42a894e71ada56b09ce53a26.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925000/0xc3610171279c631a1bbf259a14f6b330cee148c1.gif"
    },
    {
        "hash": "0xf3ca7af2411df1c26807ef8bea18900e423b8f42",
        "timestamp": "2024-07-11T05:35:53.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/fe288abb87f69904d88c3db762819771.m3u8"
            },
            {
                "castId": {
                    "fid": 244348,
                    "hash": "0x96443ae7f298a0f54c58eee893ec6787ec64c254"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925001/0xf3ca7af2411df1c26807ef8bea18900e423b8f42.gif"
    },
    {
        "hash": "0xf1078cb09ea7a64cc033e3921e95d1d463c07de3",
        "timestamp": "2024-07-10T05:48:16.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/10f46e45f3dc8cc0b03c238295a1ca90.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925003/0xf1078cb09ea7a64cc033e3921e95d1d463c07de3.gif"
    },
    {
        "hash": "0x8c34bffb8a5f566d5dd4c0b4509ada2e74bed1bd",
        "timestamp": "2024-07-10T05:10:27.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/6ba43e2492f3bd094f78f0b372e85288.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925003/0x8c34bffb8a5f566d5dd4c0b4509ada2e74bed1bd.gif"
    },
    {
        "hash": "0xb018be5d289af535aef93217f9dfee2194ff756d",
        "timestamp": "2024-07-10T01:48:55.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/463fcf60cce5dbf569b3b5b08f0d321c.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925004/0xb018be5d289af535aef93217f9dfee2194ff756d.gif"
    },
    {
        "hash": "0x969874521ecd2ce7945860de90bd201166cfe2b5",
        "timestamp": "2024-07-09T15:17:31.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/a49b233ce2eb7c8acdf33ddeec8be3a8.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925005/0x969874521ecd2ce7945860de90bd201166cfe2b5.gif"
    },
    {
        "hash": "0xde82c9fc4efaa03b5bc12d4a4bf97cf4087c4bfd",
        "timestamp": "2024-07-09T14:50:28.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/87d38d50e9e98b8036c59694657110fe.m3u8"
            },
            {
                "castId": {
                    "fid": 2904,
                    "hash": "0x59e7a5dcfe5f85cddb4a9487fd81ab9bb3700657"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925006/0xde82c9fc4efaa03b5bc12d4a4bf97cf4087c4bfd.gif"
    },
    {
        "hash": "0x538db9425d165daef61e16b51b600a6ffbea4ca8",
        "timestamp": "2024-07-09T14:12:53.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/c36c98e50b5fd65f826504fd4366e544.m3u8"
            },
            {
                "castId": {
                    "fid": 6596,
                    "hash": "0x193a39d3bc6dd1766b9642d29416f564cb1d968a"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925008/0x538db9425d165daef61e16b51b600a6ffbea4ca8.gif"
    },
    {
        "hash": "0x2a8948937c4bf1d4a59191bdd90a6266149d82cb",
        "timestamp": "2024-07-09T11:45:07.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/a79555d37754871c425c42cb934dfe21.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925009/0x2a8948937c4bf1d4a59191bdd90a6266149d82cb.gif"
    },
    {
        "hash": "0x131c54ebf8d1a9c82fdba8db94d0034b713ff580",
        "timestamp": "2024-07-09T08:36:27.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/459a1a608f1ac4a45dc8b4bc2c53388e.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925011/0x131c54ebf8d1a9c82fdba8db94d0034b713ff580.gif"
    },
    {
        "hash": "0x469b3c455e1001442e481ff66ee86aee2ec5bd27",
        "timestamp": "2024-07-09T04:05:13.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/322eea77e998edea35d89836ae22adf0.m3u8"
            },
            {
                "castId": {
                    "fid": 4482,
                    "hash": "0x31dbee01167485cbb38332d47012018c373067ab"
                }
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925012/0x469b3c455e1001442e481ff66ee86aee2ec5bd27.gif"
    },
    {
        "hash": "0x59c507a5fb9596b6a3dd4333361f6791f9fe3884",
        "timestamp": "2024-07-09T03:46:57.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/8ea3089dc97357cf035a1c38cfc895a2.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925013/0x59c507a5fb9596b6a3dd4333361f6791f9fe3884.gif"
    },
    {
        "hash": "0x5ca917bdcce1c0c7212e12d7846c65ce4ee775e1",
        "timestamp": "2024-07-08T12:16:16.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/52a7f4cd8ee31d1e47c9b6d4a71b0934.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925014/0x5ca917bdcce1c0c7212e12d7846c65ce4ee775e1.gif"
    },
    {
        "hash": "0x8aa22fd9f3d40ee1a82082e79922d477dea9bf5d",
        "timestamp": "2024-07-08T10:43:25.000Z",
        "embeds": [
            {
                "url": "https://stream.warpcast.com/v1/video/57b55361125b095a3b271279b60eed74.m3u8"
            }
        ],
        "upload_url": "https://res.cloudinary.com/dzpugkpuz/image/upload/v1720925015/0x8aa22fd9f3d40ee1a82082e79922d477dea9bf5d.gif"
    }
]
}

tvFrame.frame('/:username/:index', async (c) => {
  const { username, index } = c.req.param()
  
  if(username == "kevinmfer" || username == "maretus.eth") {
    const userCasts = channels[username]
    const currentIndex = Number(index)
    const nextIndex = (currentIndex + 1) % userCasts.length;
    const thisCast = userCasts[currentIndex];
    const qs = {
      text: `first time i see a tv inside a frame.\n\nby @jpfraneto 🎩`,
      'embeds[]': [
        `https://api.anky.bot/tv/${username}/${index}`,
      ],
    };
    
    const shareQs = queryString.stringify(qs);
    const warpcastRedirectLink = `https://warpcast.com/~/compose?${shareQs}`;
    return c.res({
      title: 'vibra.so',
      image: thisCast.upload_url,
      intents: [
        <Button.Link href={warpcastRedirectLink}>share episode</Button.Link>,
        <Button.Link href={`https://www.warpcast.com/${username}/${thisCast.hash.slice(0,10)}`}>OG cast</Button.Link>,
        <Button action={`/kevinmfer/${nextIndex}`}>next ▶️</Button>,
        <Button action="/">back</Button>
      ],
    });
  } else {
    return c.res({
      title: 'vibra.so',
      image: (
        <div tw="flex h-full w-full flex-col px-8 items-left py-4 justify-center bg-black text-white">
          <span tw="text-cyan-500 text-2xl mb-2">this user's tv channel is not available yet</span>
          <span tw="text-cyan-500 text-2xl">tell them to cast more videos</span>
          <span tw="text-cyan-500 text-2xl">maybe it is time for some /vibra</span>
        </div>
      ),
      intents: [
        <Button.Link href={`https://www.vibra.so/`}>more info</Button.Link>,
      ],
    });
  }
})


