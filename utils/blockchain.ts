import {
    createPublicClient,
    erc20Abi,
    erc721Abi,
    getAddress,
    http,
  } from 'viem';
  import * as chains from 'viem/chains';
  import { ALCHEMY_INSTANCES, getTransport } from './web3';
import { HYPERSUB_ABI } from '../src/constants/abi/HYPERSUB_ABI';


  export function getViemChain(chainId: number) {
    const found = Object.values(chains).find((chain) => chain.id === chainId);
    if (!found) {
      throw new Error(`Chain with id ${chainId} not found`);
    }
  
    return found;
  }
  

const chainId = 8453
const chain = getViemChain(Number(chainId));

const publicClient = createPublicClient({
chain,
transport: getTransport(chainId),
});

export async function checkBalanceOnContract(userWalletAddress:string, tokenAddress:string) {
    try {
        const balance = await publicClient
                .readContract({
                abi: HYPERSUB_ABI,
                address: getAddress(tokenAddress) as `0x${string}`,
                functionName: 'balanceOf',
                args: [userWalletAddress as `0x${string}`],
                })
                .catch(() => 0);
        console.log("the balance of the function is: ",userWalletAddress, balance )
        return balance
    } catch (error) {
        
    }
}