



import fs from 'fs';
import csv from 'csv-parser';
import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { NEYNAR_DUMMY_BOT_API_KEY, BASE_RPC_URL } from '../env/server-env';
import { CONTRACT_ABI } from '../src/constants/abi/CONTRACT_ABI';

dotenv.config();

const NEYNAR_API_KEY = NEYNAR_DUMMY_BOT_API_KEY ;
const RPC_URL = BASE_RPC_URL; // Your Ethereum node RPC URL
const OUTPUT_FILE = 'airdrop_data.json';
const API_DELAY = 88; // 1 second delay between API calls

interface CsvRow {
  HolderAddress: string;
  Balance: string;
  PendingBalanceUpdate: string;
}

interface AirdropData {
  fid: number;
  airdropAllocation: string;
  airdropContractAddress: string;
  userAirdropAddress: string;
  username: string;
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

async function getBeneficiary(contractAddress: string): Promise<string | null> {
    const abi = ['function beneficiary() view returns (address)'];
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    try {
      return await contract.beneficiary();
    } catch (error) {
      console.error(`Error calling beneficiary() for ${contractAddress}:`, error.message);
      return null;
    }
  }
  
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserData(address: string): Promise<any> {
  const options = {
    method: 'GET',
    url: `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
    headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
  };

  try {
    await delay(API_DELAY); // Add delay before each API call
    const response = await axios.request(options);
    return response.data[address][0];
  } catch (error) {
    console.error(`Error fetching user data for ${address}:`, error);
    return null;
  }
}

export async function processData() {
    console.log("inside the process dataaaaa")
  const results: AirdropData[] = [];
  const stream = fs.createReadStream('moxieholders.csv').pipe(csv());

  for await (const row of stream) {
    console.log("The row is: ", row)
    const csvRow = row as CsvRow;
    const contractAddress = csvRow.HolderAddress;
    console.log("The contract address is: ", contractAddress)
    const beneficiaryAddress = await getBeneficiary(contractAddress);
    const userData = await getUserData(beneficiaryAddress);

    if (userData) {
      results.push({
        fid: userData.fid,
        airdropAllocation: csvRow.Balance.replace(/,/g, ''),
        airdropContractAddress: contractAddress,
        userAirdropAddress: beneficiaryAddress,
        username: userData.username,
      });
    }

    console.log(`Processed: ${contractAddress}`); // Log progress
  }

  // Store data in a file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  // Create an index for quick access by FID
  const indexByFid: { [key: number]: AirdropData } = {};
  results.forEach(item => {
    indexByFid[item.fid] = item;
  });

  fs.writeFileSync('airdrop_data_index.json', JSON.stringify(indexByFid, null, 2));

  console.log(`Processed ${results.length} entries. Data stored in ${OUTPUT_FILE} and airdrop_data_index.json`);
}

