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

// **** ROUTE IMPORTS ****
import { app as landing } from './routes/landing'
import { ankyGenesis } from './routes/anky-genesis'
// **** ROUTE IMPORTS ****

// **** FAST SCRIPTS ****
// deleteAll();
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
  console.log('Full URL:', fullUrl);
  console.log('Query String:', queryString);
  
  if (queryString) {
    const params = new URLSearchParams(queryString);
    console.log('Decoded Query Parameters:');
    for (const [key, value] of params.entries()) {
      console.log(`  ${key}: ${decodeURIComponent(value)}`);
    }
  }

  console.log('Headers:', c.req.header);
  
  // If it's a POST request, log the body
  if (c.req.method === 'POST') {
    const body = await c.req.json().catch(() => 'Unable to parse JSON body');
    console.log('Request Body:', body);
  }

  await next();
});

app.route('/', landing);
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