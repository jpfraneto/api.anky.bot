import dotenv from 'dotenv'
import {object, parse, string, number} from 'valibot'

const envSchema = object({
    SECRET: string('SECRET is required'),
    ALCHEMY_API_KEY: string('ALCHEMY_API_KEY is required'),
    FARCASTER_DEVELOPER_FID: string('FARCASTER_DEVELOPER_FID is required'),
    FARCASTER_UUID: string('FARCASTER_UUID is required'),
    FARCASTER_PUBLIC_KEY: string('FARCASTER_PUBLIC_KEY is required'),
    FARCASTER_DEVELOPER_MNEMONIC: string(
      'FARCASTER_DEVELOPER_MNEMONIC is required',
    ),
    NEYNAR_API_KEY: string('NEYNAR_API_KEY is required'),
    OPENAI_API_KEY: string('OPENAI_API_KEY is required'),
    POIESIS_API_KEY: string('POIESIS_API_KEY is required'),
    MY_SIGNER: string('MY_SIGNER is required'),
    PORT: string("PORT is required")
  });
  
  export const {
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
  } = parse(envSchema, process.env);