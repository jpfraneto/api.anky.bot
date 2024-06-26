import axios from "axios";
import "dotenv/config";
import { Cast } from "./types/cast";
import prisma from "./prismaClient";

export async function deleteAll() {
  console.log("inside the delete all function");
  try {
    const url = `https://api.neynar.com/v2/farcaster/feed/user/18350/replies_and_recasts?limit=50&viewer_fid=18350`;

    const castResponse = await axios.get(url, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
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
            api_key: process.env.NEYNAR_API_KEY,
            "content-type": "application/json",
          },
          data: {
            target_hash: cast.hash,
            signer_uuid: process.env.ANKY_SIGNER_UUID,
          },
        };
        axios
          .request(options)
          .then(function (response) {
            console.log(response.data);
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

export async function getThisCastInformationFromHash(castHash: string) {
  try {
    console.log("looking for this cast", castHash);
    const castResponse = await axios.get(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash&viewer_fid=16098`,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    return castResponse.data.cast;
  } catch (error) {
    console.log("there was an error festing the cast from neynar", error);
    const deletedReply = await prisma.replyFromAnky.deleteMany({
      where: {
        replyCastHash: castHash,
      },
    });
    console.log("The response from deleting the reply is: ", deletedReply);
    return null;
  }
}

export async function getThisCastInformationFromUrl(castUrl: string) {
  try {
    const castResponse = await axios.get(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(
        castUrl
      )}&type=url&viewer_fid=16098`,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    return castResponse.data.cast;
  } catch (error) {
    console.log("there was an error festing the cast from neynar", castUrl);
  }
}
