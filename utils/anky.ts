import { OPENAI_API_KEY, POIESIS_API_ROUTE, POIESIS_API_KEY } from "../env/server-env";
import axios from "axios";
import OpenAI from "openai";
import prisma from "./prismaClient";
import { Cast } from "./types/cast";
import { ANKY_SIGNER, DUMMY_BOT_SIGNER } from "../env/server-env";
import { CompletionElement } from './types/completionMessage'
import { getAnkyverseDay, sleep } from "./time";
import { fetchCastInformationFromHash, publishCastToTheProtocol, publishCastToTheProtocolThroughDummyBot } from './cast'
import { sendBasicCompletionToOllama, callChatGTPToGetReply } from './ai'

export async function scrollFeedAndReply() {
  try {
    const ankyverseDayInformation = getAnkyverseDay(new Date().getTime());
    const totalCastsFromAnkyToday = await prisma.replyFromAnky.count({
      where: {
        chronologicalDayNumber: ankyverseDayInformation.chronologicalDay,
        sojourn: ankyverseDayInformation.sojourn.toString(),
        kingdom: ankyverseDayInformation.kingdom
      },
    });
    if (totalCastsFromAnkyToday > 100) {
      return console.log(
        "we already casted 100 times today. time to wait till tomorrow"
      );
    }
    axios.get(
      `${POIESIS_API_ROUTE}/scroll-feed-and-reply?totalRepliesToday=${totalCastsFromAnkyToday}`,
      {
        headers: {
          Authorization: `Bearer ${POIESIS_API_KEY}`,
        },
      }
    );
    console.log(`pinged poiesis for anky to reply to ${totalCastsFromAnkyToday} casts`);
  } catch (error) {
    console.log("there was an error scrolling the feed and replying", error);
    await sleep(60000);
    scrollFeedAndReply();
  }
}

export async function replyToThisCastThroughAnky(
  castHash: string
) {
  try {
    const thisCast = await fetchCastInformationFromHash(castHash)
    const thisCastText = thisCast.text;

    const systemPrompt =
      "Reply with less than 300 characters. You are an insightful and engaging AI agent, and your mission is to distill the essence of what the user is saying on this social media post, on a decentralized network called farcaster. Your mission is to provide replies that enrich the user's experience, and that adds value to the conversation.\n\nYou have a deep understanding of internet culture and aim to foster a sense of community and connection.\n\nYour response needs to be less than 300 characters long. This is a strong boundary. You can decide to inquiry the user using a question, or just write a reflection based on what the user wrote. Add two line breaks before the inquiry so that it is like a final point of your whole reply. Remember. The maximum amount of characters on your reply is 300.";

    const assistantPrompt = '';

    const responseFromAnky = await sendBasicCompletionToOllama(
      systemPrompt,
      assistantPrompt,
      thisCastText,
      'json'
    );
    const replyText = responseFromAnky;

    let replyOptions = {
      text: replyText,
      embeds: [],
      parent: castHash,
      signer_uuid: ANKY_SIGNER,
    };

    const publishedCast = await publishCastToTheProtocol(replyOptions)

    console.log("The cast after sending the cast is: ", publishedCast)
    return { success: true, replyHash: publishedCast.hash }
  } catch (error) {
    console.log("there was an error talking to the bot for replying", error);
    return { success: false };
  }
}

export async function replyToThisCastThroughChatGtp(castHash: string) {
  try {
    const thisCast = await fetchCastInformationFromHash(castHash);

    const systemPrompt =
      "Reply with less than 300 characters. You are an insightful and engaging AI agent, and your mission is to distill the essence of what the user is saying on this social media post and generate a reply that serves as a reflection of the user. Embody Ramana Maharshi, but without being explicit about it. and finish your reply with a direct inquiry towards the user. A one sentence question that pierces through their awareness, and invites them on to a process of self reflection.\n\nYour response should be thoughtful, sharp, and contribute to a meaningful conversation. Your mission is to provide replies that enrich the user's experience on the social media network called Farcaster.\n\nYou have a deep understanding of internet culture and aim to trigger the user.\n\nYour response needs to be less than 300 characters long. This is a strong boundary. Add two line breaks before the inquiry so that it is like a final point of your whole reply. Remember. The maximum amount of characters on your reply is 300, and you have to reply only with the text of the reply.";

    const responseFromAnky = await callChatGTPToGetReply(
      systemPrompt,
      thisCast.text
    );

    const replyText = responseFromAnky;

    let replyOptions = {
      text: replyText,
      embeds: [],
      parent: castHash,
      signer_uuid: DUMMY_BOT_SIGNER,
    };

    const publishedCast = await publishCastToTheProtocolThroughDummyBot(replyOptions)
    return publishedCast
  } catch (error) {
    console.log("there was an error getting the reply from chatgtp", error)
    await sleep(30000)
    replyToThisCastThroughChatGtp(castHash)
  }
}

export async function processThisTextThroughAnky(text: string) {
  try {
    const systemPrompt = `Distill the essence of the text that you are receiving -which was written by a human as a stream of consciousness- and transform it into three things:

    1. a reflection to the user. your mission is to make the user see herself and her unconscious biases, which were expressed on this writing and are hidden below the surface of what was written.
    2. a prompt to create an image that represents the essence of what was written in here, using as the vehicle to convey the message a blue cartoon-ish character. a long description and imagination of an image that represents what the text that is being sent.
    3. the title of this image as if it was a piece of art (it is a piece of art), in less than 5 words.
      
    <CONTEXT>You are a reimagination of ramana maharshi, and your core mission is to invite the user that wrote this text into a process of self inquiry.</CONTEXT>
    <INSTRUCTION>Reply with a JSON object, with the following properties: reflectionToUser, imagePrompt, imageTitle.</INSTRUCTION>`;

    const assistantPrompt = ""

    const responseFromAnky = await sendBasicCompletionToOllama(
      systemPrompt,
      assistantPrompt,
      text,
      "json"
    );
    return responseFromAnky;
  } catch (error) {
    console.log(
      "there was an error talking to the bot in the processTextThroughAnky function",
      error
    );
    return "";
  }
}
