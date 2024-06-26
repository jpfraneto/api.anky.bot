import dotenv from 'dotenv';
import { object, string, safeParse } from 'valibot';

dotenv.config();

const envSchema = object({
  SECRET: string(),
  ALCHEMY_API_KEY: string(),
  FARCASTER_DEVELOPER_FID: string(),
  FARCASTER_UUID: string(),
  FARCASTER_PUBLIC_KEY: string(),
  FARCASTER_DEVELOPER_MNEMONIC: string(),
  NEYNAR_API_KEY: string(),
  OPENAI_API_KEY: string(),
  POIESIS_API_KEY: string(),
  MY_SIGNER: string(),
  PORT: string()
});

const result = safeParse(envSchema, process.env);

if (!result.success) {
  console.error('Environment variables validation failed:', result.error);
  process.exit(1);
}

const {
  SECRET,
  ALCHEMY_API_KEY,
  FARCASTER_PUBLIC_KEY,
  FARCASTER_UUID,
  FARCASTER_DEVELOPER_FID,
  FARCASTER_DEVELOPER_MNEMONIC,
  POIESIS_API_KEY,
  OPENAI_API_KEY,
  NEYNAR_API_KEY,
  MY_SIGNER,
  PORT
} = result.output;

export {
  SECRET,
  ALCHEMY_API_KEY,
  FARCASTER_PUBLIC_KEY,
  FARCASTER_UUID,
  FARCASTER_DEVELOPER_FID,
  FARCASTER_DEVELOPER_MNEMONIC,
  POIESIS_API_KEY,
  OPENAI_API_KEY,
  NEYNAR_API_KEY,
  MY_SIGNER,
  PORT
};
