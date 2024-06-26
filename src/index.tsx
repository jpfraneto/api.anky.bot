import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Button, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import prisma from "../lib/prismaClient";
import axios from "axios";
import cron from "node-cron";
import { Cast } from "../lib/types/cast";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { createHmac } from "crypto";
import crypto from "crypto";
import {
  checkAndUpdateRepliesScores,
  downloadAllTrainingDataForToday,
} from "../lib/replyManager";
import {
  getThisCastInformationFromHash,
  getThisCastInformationFromUrl,
  deleteAll,
} from "../lib/farcaster";
import {
  scrollFeedAndReply,
  getOldRepliesAndProcessThem,
  replyToThisCastFromChatgtp,
} from "../lib/anky";

// **** ROUTE IMPORTS ****

import { app as ankyGenesis } from './routes/anky-genesis'

// **** ROUTE IMPORTS ****

// **** FAST SCRIPTS ****

// deleteAll();
// scrollFeedAndReply();
// checkAndUpdateRepliesScores();
// downloadAllTrainingDataForToday()
// checkAndUpdateRepliesScores();

// **** DAILY ACTIONS AT THE END OF THE DAY ****

// calculate the daily user performance for all of the ones that participate on the system
// 
// fine tune anky (on poiesis)
//
//

cron.schedule("*/30 * * * *", () => {
  scrollFeedAndReply();
});

export const app = new Frog({
  basePath: "/",
  imageOptions: {
    fonts: [
      {
        name: "Righteous",
        source: "google",
      },
    ],
  },
});

app.route('/anky-genesis', ankyGenesis)

app.use("/*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  return c.json({
    134: 124,
  });
});

app.post("/jpfraneto-replied", async (c) => {
  try {
    console.log("INSIDE THE JPFRANETO CASTED WEBHOOK ", c);
    const text = await c.req.text();
    console.log("the boyd is: ", text);

    const responseData = JSON.parse(text);
    const castData = responseData.data;

    const responseFromReplying = await replyToThisCastFromChatgtp(
      castData.parent_hash
    );
    const parentCast = await getThisCastInformationFromHash(
      castData.parent_hash
    );

    console.log("the response from replying is ", responseFromReplying);
    // add reply to the database as a good / bad reply pair
    const prismaResponse = await prisma.replyForTrainingAnky.create({
      data: {
        rootCastHash: castData.parent_hash,
        rootCastText: parentCast.text,
        goodReplyHash: castData.hash,
        goodReplyText: castData.text,
        badReplyHash: responseFromReplying.cast.hash,
        badReplyText: responseFromReplying.cast.text,
      },
    });
    return c.json({
      134: 124,
    });
  } catch (error) {
    console.log("THERE WAS AN ERROR ON THE JPFRANETO REPLIED ROUTE");
  }
});

// for installing the cast action
app.frame("/install-save-this-reply", (c) => {
  return c.res({
    image: (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(to right, #432889, #17101F)",
          backgroundSize: "100% 100%",
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          height: "100%",
          justifyContent: "center",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 50,
            fontStyle: "normal",
            letterSpacing: "-0.025em",
            lineHeight: 1,
            display: "flex",
            marginTop: 30,
            padding: "0 120px",
            whiteSpace: "pre-wrap",
          }}
        >
          add "save this reply" action
        </div>
      </div>
    ),
    intents: [
      <Button.AddCastAction action="/save-this-reply-action">
        add
      </Button.AddCastAction>,
    ],
  });
});

// cast action trigger that displays the frame
app.castAction(
  "/save-this-reply-action",
  (c) => {
    const { actionData } = c;
    const { castId, fid, messageHash, network, timestamp, url } = actionData;
    const goodReplyHash = castId.hash;
    console.log(
      "inside the cast action, the goodreplyhash is ,",
      goodReplyHash
    );
    return c.res({
      type: "frame",
      path: `https://api.anky.bot/save-this-reply-frame/${goodReplyHash}`,
    });
  },
  { name: "save this reply", icon: "log" }
);

// initial frame image, which already knows the hash of the (good) reply that is being saved and the root cast hash
app.frame("/save-this-reply-frame/:goodReplyHash", (c) => {
  const { goodReplyHash } = c.req.param();
  return c.res({
    action: `/store-on-database/${goodReplyHash}`,
    image: (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(to right, #432889, #17101F)",
          backgroundSize: "100% 100%",
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          height: "100%",
          justifyContent: "center",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 50,
            fontStyle: "normal",
            letterSpacing: "-0.025em",
            lineHeight: 1,
            display: "flex",
            marginTop: 30,
            padding: "0 120px",
            whiteSpace: "pre-wrap",
          }}
        >
          you are calling this cast action on a good reply. please enter the
          warpcast url of the bad reply to store these three on the database.
        </div>
      </div>
    ),

    intents: [
      <TextInput placeholder="full warpcast url" />,
      <Button value="reply">send</Button>,
      <Button value="my stats">my stats</Button>,
    ],
  });
});

async function storeOnDatabase(
  replyParentCast: Cast,
  goodReplyCast: Cast,
  badReplyCast: Cast
) {
  try {
    const prismaResponse = await prisma.replyForTrainingAnky.create({
      data: {
        rootCastHash: replyParentCast.hash,
        rootCastText: replyParentCast.text,
        goodReplyHash: goodReplyCast.hash,
        goodReplyText: goodReplyCast.text,
        badReplyHash: badReplyCast.hash,
        badReplyText: badReplyCast.text,
      },
    });
    return prismaResponse.id;
  } catch (error) {
    console.log("there was an error adding the casts to the database");
  }
}

async function getUsersRepliesDataForToday(fid: number) {
  try {
    // fetch this users replies data for today
    const usersData = {
      totalRootCasts: 2,
      totalReplies: 33,
      quoteCasts: 12,
      commentsOnUserReplies: 33,
      recastsOfReplies: 8,
      likesOnUserReplies: 58,
      todayReplyScore: 55.8,
    };
    console.log("in here", usersData);
    return usersData;
  } catch (error) {
    console.log("there was an errrrrror");
  }
}

app.frame("/store-on-database/:goodReplyHash", async (c) => {
  try {
    if (c.buttonIndex == 2 && c?.frameData?.fid) {
      const userData = await getUsersRepliesDataForToday(c?.frameData?.fid);
      return c.res({
        // action: `/store-on-database/${goodReplyHash}`,
        image: (
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(to right, #432889, #17101F)",
              backgroundSize: "100% 100%",
              display: "flex",
              flexDirection: "column",
              flexWrap: "nowrap",
              height: "100%",
              justifyContent: "center",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                color: "white",
                height: "100%",
                fontSize: 44,
                fontStyle: "normal",
                letterSpacing: "-0.025em",
                lineHeight: 0.5,
                display: "flex",
                marginTop: 30,
                padding: "0 120px",
                flexDirection: "column",
              }}
            >
              <p>day X</p>
              <p>total root casts: {userData?.totalRootCasts}</p>
              <p>total replies: {userData?.totalReplies}</p>
              <p>quote casts: {userData?.quoteCasts}</p>
              <p>comments on your replies: {userData?.commentsOnUserReplies}</p>
              <p>recasts: {userData?.recastsOfReplies}</p>
              <p>likes: {userData?.likesOnUserReplies}</p>
              <p>today score: {userData?.todayReplyScore}</p>
            </div>
          </div>
        ),
        intents: [<Button.Link href="share my stats">send</Button.Link>],
      });
    } else {
      const { goodReplyHash } = c.req.param();
      const { frameData, verified } = c;
      const fid = c?.frameData?.fid || 18350;
      if (![16098, 18350].includes(fid)) {
        return c.res({
          image: (
            <div
              style={{
                alignItems: "center",
                background: "linear-gradient(to right, #432889, #17101F)",
                backgroundSize: "100% 100%",
                display: "flex",
                flexDirection: "column",
                flexWrap: "nowrap",
                height: "100%",
                justifyContent: "center",
                textAlign: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  color: "white",
                  fontSize: 50,
                  fontStyle: "normal",
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  display: "flex",
                  marginTop: 30,
                  padding: "0 120px",
                  whiteSpace: "pre-wrap",
                }}
              >
                you are not authorized to use this cast action. sorry about
                that.
              </div>
            </div>
          ),
        });
      }

      if (
        !c?.inputText?.match(
          /^https:\/\/warpcast\.com\/[a-zA-Z0-9_-]+\/0x[0-9a-fA-F]+$/
        )
      ) {
        return c.res({
          action: `/store-on-database/${goodReplyHash}`,
          image: (
            <div
              style={{
                alignItems: "center",
                background: "linear-gradient(to right, #432889, #17101F)",
                backgroundSize: "100% 100%",
                display: "flex",
                flexDirection: "column",
                flexWrap: "nowrap",
                height: "100%",
                justifyContent: "center",
                textAlign: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  color: "white",
                  fontSize: 50,
                  fontStyle: "normal",
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  display: "flex",
                  marginTop: 30,
                  padding: "0 120px",
                  whiteSpace: "pre-wrap",
                }}
              >
                the formatting of the bad cast is not a warpcast link. please
                try harder, go back, copy the bad warpcast link, and call this
                cast action from a good reply
              </div>
            </div>
          ),
        });
      }

      const badReplyLink = c.inputText;

      // Start fetching goodReplyCast and badCast in parallel
      const goodReplyCastPromise =
        getThisCastInformationFromHash(goodReplyHash);
      const badCastPromise = getThisCastInformationFromUrl(badReplyLink);

      // Wait for the goodReplyCast to resolve to get the parent hash
      const goodReplyCast = await goodReplyCastPromise;
      const replyParentCastPromise = getThisCastInformationFromHash(
        goodReplyCast.parent_hash
      );

      // Wait for all promises to resolve
      const [replyParentCast, badCast] = await Promise.all([
        replyParentCastPromise,
        badCastPromise,
      ]);

      // Store the data associated with the bad reply link on the database
      const prismaReplyId = await storeOnDatabase(
        replyParentCast,
        goodReplyCast,
        badCast
      );

      return c.res({
        action: `/save-comment/${prismaReplyId}`,
        image: (
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(to right, #432889, #17101F)",
              backgroundSize: "100% 100%",
              display: "flex",
              flexDirection: "column",
              flexWrap: "nowrap",
              height: "100%",
              justifyContent: "center",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: 50,
                fontStyle: "normal",
                letterSpacing: "-0.025em",
                lineHeight: 1,
                display: "flex",
                marginTop: 30,
                padding: "0 120px",
                whiteSpace: "pre-wrap",
              }}
            >
              are there any comments that you want to save associated with this?
            </div>
          </div>
        ),
        intents: [
          <TextInput placeholder="add comment..." />,
          <Button value="add-comment">save</Button>,
        ],
      });
    }
  } catch (error) {
    return c.res({
      image: (
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(to right, #432889, #17101F)",
            backgroundSize: "100% 100%",
            display: "flex",
            flexDirection: "column",
            flexWrap: "nowrap",
            height: "100%",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 50,
              fontStyle: "normal",
              letterSpacing: "-0.025em",
              lineHeight: 1,
              display: "flex",
              marginTop: 30,
              padding: "0 120px",
              whiteSpace: "pre-wrap",
            }}
          >
            there was an error here
          </div>
        </div>
      ),
    });
  }
});

app.frame("/save-comment/:prismaId", async (c) => {
  const { prismaId } = c.req.param();
  const { inputText } = c;
  const startOfDayUTC = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    )
  );

  // Query the count of replyForTrainingAnky entries since the start of the day
  const savedCastsToday = await prisma.replyForTrainingAnky.count({
    where: {
      addedTimestamp: {
        gte: startOfDayUTC,
      },
    },
  });
  console.log("The saved casts today are ", savedCastsToday);
  if (inputText && inputText?.length > 2) {
    await prisma.replyForTrainingAnky.update({
      where: {
        id: prismaId,
      },
      data: {
        comments: inputText,
      },
    });

    return c.res({
      image: (
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(to right, #432889, #17101F)",
            backgroundSize: "100% 100%",
            display: "flex",
            flexDirection: "column",
            flexWrap: "nowrap",
            height: "100%",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 50,
              fontStyle: "normal",
              letterSpacing: "-0.025em",
              lineHeight: 1,
              display: "flex",
              marginTop: 30,
              padding: "0 120px",
              whiteSpace: "pre-wrap",
            }}
          >
            your comment and everything was saved. keep it going. we need more
            data to train @anky. {savedCastsToday}/100 today.
          </div>
        </div>
      ),
    });
  } else {
    return c.res({
      image: (
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(to right, #432889, #17101F)",
            backgroundSize: "100% 100%",
            display: "flex",
            flexDirection: "column",
            flexWrap: "nowrap",
            height: "100%",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 50,
              fontStyle: "normal",
              letterSpacing: "-0.025em",
              lineHeight: 1,
              display: "flex",
              marginTop: 30,
              padding: "0 120px",
              whiteSpace: "pre-wrap",
            }}
          >
            the cast triada was saved without comments. keep it going. we need
            more data to train @anky. {savedCastsToday}/100 today.
          </div>
        </div>
      ),
    });
  }
});

/// REPLYGUY STATS
app.frame("/replyguy-stats/:fid", (c) => {
  const { fid } = c.req.param();
  console.log("the fid is here, and the replyguy stats are");
  return c.res({
    // action: `/store-on-database/${goodReplyHash}`,
    image: (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(to right, #432889, #17101F)",
          backgroundSize: "100% 100%",
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          height: "100%",
          justifyContent: "center",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "white",
            height: "100%",
            fontSize: 44,
            fontStyle: "normal",
            letterSpacing: "-0.025em",
            lineHeight: 0.5,
            display: "flex",
            marginTop: 30,
            padding: "0 120px",
            flexDirection: "column",
          }}
        >
          <p>day 111</p>
          <p>total root casts: 2</p>
          <p>total replies: 33</p>
          <p>quote casts: 12</p>
          <p>comments on your replies: 33</p>
          <p>recasts: 8</p>
          <p>likes: 88</p>
          <p>today score: 55.3</p>
        </div>
      </div>
    ),

    // intents: [
    //   <TextInput placeholder="full warpcast url" />,
    //   <Button value="reply">send</Button>,
    // ]
  });
});

const port = process?.env?.PORT || 3000;

devtools(app, { serveStatic });

serve({
  fetch: app.fetch,
  port: 3000,
})

console.log(`Server is running on port ${port}`)