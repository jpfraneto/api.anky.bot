import { Context, Next } from "hono";
import { env } from "hono/adapter";
import { VIBRA_API_KEY } from "../../env/server-env";

export const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header("x-api-key");
  const expectedApiKey = VIBRA_API_KEY;

  if (!apiKey || apiKey !== expectedApiKey) {
    return c.json({ error: "Unauthorized: Invalid API Key" }, 401);
  }

  await next();
};

