import prisma from "./prismaClient";
import axios from "axios";
import { fetchCastInformationFromHash } from "../utils/cast";
import { NEYNAR_API_KEY, ANKY_SIGNER } from "../env/server-env";
import fs from "fs";
import path from "path";
import { getStartOfDay } from "./time";

export async function downloadAllTrainingDataForToday() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch today's replies
    const todaysChosenData = await prisma.replyForTrainingAnky.findMany({
      where: {
        addedTimestamp: {
          gte: twentyFourHoursAgo,
        },
      },
    });
    console.log("the todays chosen data ", todaysChosenData);
    const jsonDataPath = path.join(__dirname, "data.jsonl");
    todaysChosenData.forEach((data) => {
      const jsonDataLine = {
        system:
          'you are an ai agent that is a member of a social media network called farcaster. you are going to receive the text of a post that was shared in that network by a user whichs profile username is @${cast.author.username}. your core mission is to reply to this user in a way that is engaging to her, and to come up with something that sparks up a conversation. you are going to receive from the assistant of this prompt the last 100 casts that this user has written on the network, so that you can have context about this user. what this user cares about, how this user interacts. each reply is separated by the string "%%%%". have all this in mind. You will reply with a json object with two properties:{ "reply": your reply to this user in less than 300 characters. dont use emojis,"reasoning": an explanation of the reasoning that brought you to think why this was a good way of interacting with this user.}',
        question: data.rootCastText,
        chosen: data.goodReplyText,
        rejected: data.badReplyText,
      };
      // Write the JSONL file line to the file
      fs.appendFile(
        jsonDataPath,
        JSON.stringify(jsonDataLine) + "\n",
        (err) => {
          if (err) {
            console.error(err);
          }
        }
      );
    });
    console.log("all the data for today was downloaded");
  } catch (error) {}
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to check and update replies scores
export async function checkAndUpdateRepliesScores() {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

  // Fetch today's replies
  const todayDay = getStartOfDay(new Date().getTime());
  console.log("the today day is: ", todayDay);
  const todayReplies = await prisma.replyFromAnky.findMany({
    where: {
      //   scheduledAt: {
      //     gte: eightHoursAgo,
      //   },
      chronologicalDayNumber: todayDay,
      deletedFromFarcaster: false,
    },
  });
  console.log("todays replies are: ", todayReplies.length);
  for (const reply of todayReplies) {
    // Fetch cast data by hash
    if (!reply.replyCastHash) {
      continue;
    }
    console.log("the reply is: ", reply);
    const castData = await fetchCastInformationFromHash(
      reply.replyCastHash ?? ""
    );
    console.log("the cast data is: ", castData);

    if (castData) {
      if (
        castData.reactions.likes_count == 0 &&
        castData.reactions.recasts_count == 0 &&
        castData.replies.count == 0
      ) {
        console.log("this one sucks, delete it: ");
        const options = {
          method: "DELETE",
          url: "https://api.neynar.com/v2/farcaster/cast",
          headers: {
            accept: "application/json",
            api_key: NEYNAR_API_KEY,
            "content-type": "application/json",
          },
          data: {
            signer_uuid: ANKY_SIGNER,
            target_hash: reply.replyCastHash,
          },
        };

        const response = await axios.request(options);
        if (response.status) {
          await prisma.replyFromAnky.update({
            where: {
              id: reply.id,
            },
            data: {
              deletedFromFarcaster: true,
            },
          });
          console.log("this cast was deleted");
          await delay(444);
        } else {
          const cast = castData.cast;

          // Extracting metrics
          const likesCount = cast.reactions.likes_count;
          const recastsCount = cast.reactions.recasts_count;
          const repliesCount = cast.replies.count;
          const engagementScore = likesCount + recastsCount + repliesCount;

          // Update the reply with the new metrics
          await prisma.replyFromAnky.update({
            where: {
              id: reply.id,
            },
            data: {
              likes: likesCount,
              recasts: recastsCount,
              comments: repliesCount,
              engagementScore: engagementScore,
            },
          });
          await delay(2000);
        }
      }
    }
  }
}
