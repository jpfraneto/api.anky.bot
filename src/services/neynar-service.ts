import { NeynarAPIClient, isApiErrorResponse } from '@neynar/nodejs-sdk';
import {
  ANKY_SIGNER,
  NEYNAR_API_KEY,
  NODE_ENV
} from '../../env/server-env';
import { neynar } from 'frog/middlewares';
import { Logger } from '../../utils/Logger';

export const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);

export const neynarMiddleware = neynar({
  apiKey: NEYNAR_API_KEY,
  features: ['interactor', 'cast'],
});

export async function signerActive(uuid: string) {
  const { status, fid } = await neynarClient.lookupSigner(uuid);
  return { alive: status === 'approved', status, fid };
}

export async function cast(params: {
  text: string;
  embeds: { url: string }[];
  parentHash?: string;
  forceCast?: boolean;
}) {
  const { text, embeds, forceCast = false, parentHash } = params;
  console.log(text, { embeds, replyTo: parentHash });
  if (NODE_ENV !== 'production' && !forceCast) {
    Logger.info('Not in production, skipping cast');
    return;
  }

  let castRootHash = null;
  let lastHash = parentHash;

  // Improved chunking with URL preservation and dynamic byte size checking
  const createChunks = (text: string, maxBytes: number): string[] => {
    const chunks = [];
    let currentChunk = '';

    for (const char of text) {
      // Check if adding the next character exceeds the max byte size
      if (
        new Blob([currentChunk + char]).size <= maxBytes ||
        currentChunk === ''
      ) {
        currentChunk += char;
      } else {
        chunks.push(currentChunk);
        currentChunk = char;
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  // Use the new createChunks function with a max byte size of 320
  const chunks = createChunks(text, 320);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLastChunk = i === chunks.length - 1;
    const { hash } = await neynarClient.publishCast(ANKY_SIGNER, chunk, {
      replyTo: lastHash,
      embeds: isLastChunk ? embeds : [],
    });
    await new Promise((resolve) => setTimeout(resolve, 2000)); // give some room for sync
    lastHash = hash;
    if (!castRootHash) castRootHash = hash;
  }

  return castRootHash as `0x${string}`;
}

// async function init() {
//   const oneYearInSeconds = 365 * 24 * 60 * 60;
//   console.log(`One year has ${oneYearInSeconds} seconds.`);
//   const resp = await neynarClient.createSignerAndRegisterSignedKey(
//     FARCASTER_ANKY_MNEMONIC,
//     {
//       deadline: Math.floor(Date.now() / 1000) + oneYearInSeconds * 5,
//     },
//   );
//   console.log(resp);
// }
// async function status() {
//   const resp = await neynarClient.lookupSigner('SIGNER KEY');
//   console.log(resp);
// }

// await status();
// only need to run this once, to create a signer and register the signed key
// after you confirm the url given in the console
// save the signer uuid and public key in .env
// no need to do it again until you want to create a new signer
// init();

export async function getLastCastForUser(fid: number) {
  let cursor,
    tipHash = '';
  do {
    const {
      result: { next, casts },
    } = await neynarClient.fetchAllCastsCreatedByUser(fid, {
      cursor,
      limit: 10,
    });

    const castWithoutParentHash = casts.filter((c) => !c.parentHash);
    if (castWithoutParentHash.length > 0) {
      tipHash = castWithoutParentHash[0].hash;
      break;
    }

    cursor = next.cursor ?? undefined;
  } while (cursor);

  return tipHash;
}