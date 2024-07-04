import dotenv from 'dotenv';
import { object, parse, string } from 'valibot'

dotenv.config();

const envSchema = object({
    SECRET: string('SECRET is required'),
    DATABASE_URL: string('DATABASE_URL is required'),
    ANKYSYNC_SIGNER: string('ANKYSYNC_SIGNER is required'),
    FARCASTER_ANKYSYNC_FID: string('FARCASTER_ANKYSYNC_FID is required'),
    FARCASTER_ANKYSYNC_MNEMONIC: string('FARCASTER_ANKYSYNC_MNEMONIC is required'),
    ANKY_SIGNER: string('ANKY_SIGNER is required'),
    FARCASTER_ANKY_FID: string('FARCASTER_ANKY_FID is required'),
    FARCASTER_ANKY_MNEMONIC: string('FARCASTER_ANKY_MNEMONIC is required'),
    ANKY_WARPCAST_API_KEY: string('ANKY_WARPCAST_API_KEY is required'),
    NEYNAR_API_KEY: string('NEYNAR_API_KEY is required'),
    NEYNAR_DUMMY_BOT_API_KEY: string("NEYNAR_DUMMY_BOT_API_KEY"),
    DUMMY_BOT_SIGNER: string("DUMMY_BOT_SIGNER"),
    PINATA_JWT: string('PINATA_JWT is required'),
    OPENAI_API_KEY: string('OPENAI_API_KEY is required'),
    POIESIS_API_ROUTE: string('POIESIS_API_ROUTE is required'),
    POIESIS_API_KEY: string('POIESIS_API_KEY is required'),
    PORT: string('PORT is required'),
    NODE_ENV: string('NODE_ENV is required'),
    FILEBASE_API_TOKEN: string("FILEBASE_API_TOKEN is required"),
    CLOUDINARY_CLOUD_NAME: string("CLOUDINARY_API_SECRET is required"),
    CLOUDINARY_API_KEY: string("CLOUDINARY_API_SECRET is required"),
    CLOUDINARY_API_SECRET: string("CLOUDINARY_API_SECRET is required")
  });
  
  export const {
    SECRET,
    DATABASE_URL,
    ANKYSYNC_SIGNER,
    FARCASTER_ANKYSYNC_FID,
    FARCASTER_ANKYSYNC_MNEMONIC,
    ANKY_SIGNER,
    FARCASTER_ANKY_FID,
    FARCASTER_ANKY_MNEMONIC,
    ANKY_WARPCAST_API_KEY,
    NEYNAR_API_KEY,
    NEYNAR_DUMMY_BOT_API_KEY,
    DUMMY_BOT_SIGNER,
    PINATA_JWT,
    OPENAI_API_KEY,
    POIESIS_API_ROUTE,
    POIESIS_API_KEY,
    PORT,
    NODE_ENV,
    FILEBASE_API_TOKEN,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = parse(envSchema, process.env);