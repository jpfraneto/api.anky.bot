import { NEYNAR_API_KEY, PINATA_JWT, ANKY_SIGNER, NEYNAR_DUMMY_BOT_API_KEY} from "../env/server-env";
import { sleep } from "./time";
import axios from "axios";
import { CastIntention, Cast } from "./types/cast";
import prisma from "./prismaClient";
import { getStartOfDay } from "./time";

export async function fetchCastInformationFromHash(castHash: string) {
    try {
      const neynarResponse = await axios.get(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash&viewer_fid=18350`,
        {
          headers: {
            api_key: NEYNAR_API_KEY,
          },
        }
      );
      return neynarResponse.data.cast;
    } catch (error) {
      console.log("there was an error fetching the cast from neynar, trying pinata now", error)
      try {
        const pinataResponse = await axios.get(
          `https://api.pinata.cloud/v3/farcaster/casts/${castHash}`,
          {
            headers: {
              api_key: NEYNAR_API_KEY,
              Authorization: `Bearer ${PINATA_JWT}`,
            },
          }
        );
        return pinataResponse.data.cast;
      } catch (error) {
        console.log(
          `this was a really hard to get cast. it didnt want to be replied to: ${castHash}`
        );
        await sleep(60000)
        return fetchCastInformationFromHash(castHash);
      }
    }
  }

  export async function fetchCastInformationFromUrl(castUrl: string) {
    try {
      const castResponse = await axios.get(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(
          castUrl
        )}&type=url&viewer_fid=16098`,
        {
          headers: {
            api_key: NEYNAR_API_KEY,
          },
        }
      );
      return castResponse.data.cast;
    } catch (error) {
      console.log("there was an error festing the cast from neynar", castUrl);
      // TODO : FETCH FROM PINATA FROM WARPCAST URL
    }
  }

  export async function getCastRepliesFromHash(castHash: string, viewer_fid: number) {
    try {
      const repliesToCast = await axios.get(
        `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=2&include_chronological_parent_casts=false&viewer_fid=${viewer_fid}1&limit=50`,
        {
          headers: {
            api_key: NEYNAR_API_KEY,
          },
        }
      );
      console.log("the repies to cast are: ", repliesToCast)
      return repliesToCast.data.conversation.direct_replies;
    } catch (error) {
      console.log("there was an error festing the cast conversation from neynar", castHash);
      // TODO : FETCH FROM PINATA FROM WARPCAST URL
    }
  }

  

export async function publishCastToTheProtocol(castOptions: CastIntention, apiKey= NEYNAR_API_KEY ) {
    try {
        const response = await axios.post(
          "https://api.neynar.com/v2/farcaster/cast",
          castOptions,
          {
            headers: {
              api_key: apiKey,
            },
          }
        );
        return response.data.cast;
      } catch (error) {
        try {
          throw new Error("add the pinata info for sending the cast")
          console.log("publishing the cast through neynar failed, now trying with pinata")
          const response = await axios.post(
            "https://api.pinata.cloud/v3/farcaster/casts",
            castOptions,
            {
             
            }
          );
          return response.data.cast;
        } catch (error) {
            console.log("trying to send the cast again", error)
            await sleep(60000)
            publishCastToTheProtocol(castOptions)
        }
      }
}

export async function publishCastToTheProtocolThroughDummyBot(castOptions: CastIntention) {
  try {
      const response = await axios.post(
        "https://api.neynar.com/v2/farcaster/cast",
        castOptions,
        {
          headers: {
            api_key: NEYNAR_DUMMY_BOT_API_KEY,
          },
        }
      );
      return response.data.cast;
    } catch (error) {
      try {
        console.log("publishing the cast through neynar failed, now trying with pinata")
        // const response = await axios.post(
        //   "https://api.pinata.cloud/v3/farcaster/casts",
        //   castOptions,
        //   {
        //     headers: {
        //       api_key: NEYNAR_DUMMY_BOT_API_KEY,
        //     },
        //   }
        // );
        // return response.data.cast;
      } catch (error) {
          console.log("neither neynar or pinata worked. try again", error)
          await sleep(60000)
          publishCastToTheProtocol(castOptions)
      }
    }
}

export async function castAnonymouslyWithFrame(
    text: string,
    irysReceiptHash = null,
    fullUrl: string,
    imageId = null
  ) {
    try {
      console.log("inside the cast anonymously with frame function");
      let embeds = [];
      if (text.length > 320) {
        text = `${text.slice(0, 300)}...`;
      }
      let castOptions = {
        text: text,
        embeds: [
          {
            url: `https://anky.bot/frames/cast?cid=${irysReceiptHash}&imageId=${imageId}`,
          },
        ],
        parent: "https://warpcast.com/~/channel/anky",
        signer_uuid: ANKY_SIGNER,
      };
      try {
        const response = await axios.post(
          "https://api.neynar.com/v2/farcaster/cast",
          castOptions,
          {
            headers: {
              api_key: NEYNAR_API_KEY,
            },
          }
        );
        return { success: true, castHash: response.data.cast.hash };
      } catch (error) {
        console.error(error);
        return { success: false };
      }
    } catch (error) {
      console.log("there was an error talking to the bo1t", error);
      return { success: false };
    }
  }

  export async function deleteAllAnkyCasts() {
    console.log("inside the delete all function");
    try {
      const url = `https://api.neynar.com/v2/farcaster/feed/user/18350/replies_and_recasts?limit=50&viewer_fid=18350`;
  
      const castResponse = await axios.get(url, {
        headers: {
          api_key: NEYNAR_API_KEY,
        },
      });
      castResponse.data.casts.forEach(async (cast: Cast) => {
        if (
          cast.reactions.likes_count == 0 &&
          cast.reactions.recasts_count == 0 &&
          cast.replies.count == 0
        ) {
          const options = {
            method: "DELETE",
            url: "https://api.neynar.com/v2/farcaster/cast",
            headers: {
              accept: "application/json",
              api_key: NEYNAR_API_KEY,
              "content-type": "application/json",
            },
            data: {
              target_hash: cast.hash,
              signer_uuid: ANKY_SIGNER,
            },
          };
          axios
            .request(options)
            .then(function (response) {
              console.log("this cast was deleted", response.data);
            })
            .catch(function (error) {
              console.error(error);
            });
        }
      });
    } catch (error) {
      console.log("there was an error", error);
    }
  }


export async function saveCastTriadeOnDatabase (parentCast: Cast, goodReply: Cast, badReply: Cast, collectorFid: number) {
  try {
    console.log("inside the save cast triade");
    let thisDay = getStartOfDay(new Date().getTime())
    const result = await prisma.replyForTrainingAnky.create({
      data: {
        dayOfStorage: thisDay,
        rootCastHash: parentCast.hash,
        rootCastText: parentCast.text,
        goodReplyHash: goodReply.hash,
        goodReplyText: goodReply.text,
        badReplyHash: badReply.hash,
        badReplyText: badReply.text,
        collectorFid: collectorFid,
        collectedFrom: "save_reply_action"
      }
    })
  } catch (error) {
    
  }
}
