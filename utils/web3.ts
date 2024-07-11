import { Alchemy, Network } from 'alchemy-sdk';
import { createPublicClient, fallback, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { ALCHEMY_API_KEY } from '../env/server-env.js';
import * as chains from 'viem/chains';

const RPCS = [
  'https://mainnet.base.org',
  'https://base-pokt.nodies.app',
  // 'https://base.gateway.tenderly.co', // NOTE: 400 on `eth_getFilterChanges`
  // 'https://gateway.tenderly.co/public/base', // NOTE: 400 on `eth_getFilterChanges`
  'https://base-rpc.publicnode.com',
  'https://developer-access-mainnet.base.org',
  'https://base.meowrpc.com',
  'https://base.llamarpc.com/',
  'https://base-rpc.publicnode.com/',
  'https://1rpc.io/base',
  'https://mainnet.base.org/',
  'https://base.meowrpc.com/',
  'https://base-pokt.nodies.app/',
  'https://base.drpc.org/',
];

export function getTransport(chainId: number) {
  if (chainId === 8453) {
    return fallback([
      http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      ...RPCS.map((rpc) => http(rpc)),
    ]);
  }

  return http();
}

export const baseAlchemy = new Alchemy({
  apiKey: ALCHEMY_API_KEY,
  batchRequests: true,
  network: Network.BASE_MAINNET,
});

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(
    'https://base-mainnet.g.alchemy.com/v2/Ef90hVumIe2tJUSzgEUCthie-246DbM7',
  ),
});

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export const ALCHEMY_INSTANCES: Record<number, Alchemy> = {
  [base.id]: baseAlchemy,
};

export function chainIdToViemChain(chainId: number) {
  return Object.values({
    ...chains,
  }).find((chain) => chain.id === chainId);
}
