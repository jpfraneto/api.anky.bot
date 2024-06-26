import dotenv from 'dotenv';
import { Frog } from "frog";
import { serve } from "@hono/node-server";
import { serveStatic } from "frog/serve-static";
import { SECRET } from '../env/server-env';
import { Logger } from '../utils/Logger';
import { devtools } from "frog/dev";
import { getPublicUrl } from '../utils/url';
import { cors } from "hono/cors"
import cron from "node-cron";
import { scrollFeedAndReply } from '../utils/anky';
import { deleteAllAnkyCasts } from '../utils/cast';

// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { ankyGenesis } from './routes/anky-genesis'
import { ankyFrames } from './routes/ankyFrame'
// **** ROUTE IMPORTS ****

// **** FAST SCRIPTS ****
deleteAllAnkyCasts();
// scrollFeedAndReply();
// checkAndUpdateRepliesScores();
// downloadAllTrainingDataForToday()
// checkAndUpdateRepliesScores();
// **** FAST SCRIPTS ****

// **** DAILY ACTIONS AT THE END OF THE DAY ****
// calculate the daily user performance for all of the ones that participate on the system
// 
// fine tune anky (on poiesis)
//
// **** DAILY ACTIONS AT THE END OF THE DAY ****

// **** PERIODIC ACTIONS THROUGHOUT THE DAY ****
// cron.schedule("*/30 * * * *", () => {
//   scrollFeedAndReply();
// });
// **** PERIODIC ACTIONS THROUGHOUT THE DAY ****

dotenv.config();

const origin = getPublicUrl();
console.log({ origin });

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
  origin,
  secret: process.env.NODE_ENV === 'production' ? SECRET : undefined,
});

app.use(async (c, next) => {
  const fullUrl = c.req.url;
  const [baseUrl, queryString] = fullUrl.split('?');
  
  Logger.info(`[${c.req.method}] ${baseUrl}`);

  await next();
});

app.route('/', landing);
app.route('/anky', ankyFrames)
app.route('/anky-genesis', ankyGenesis)

app.get("/aloja", (c) => {
  return c.json({
    134: 124,
  });
});

app.use("/*", serveStatic({ root: "./public" }));
devtools(app, { serveStatic });

const port = process.env.PORT || 3000;
console.log("the port is: ", port)

serve({
  fetch: app.fetch,
  port: Number(port),
})

console.log(`Server is running on port ${port}`)