import axios from "axios";
import { sleep } from "./time";
import { NEYNAR_API_KEY } from "../env/server-env";
import { Logger } from "./Logger";

export async function getUserFromFid(fid: number, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 5;
    const INITIAL_RETRY_DELAY = 2000; // 2 seconds
    const MAX_RETRY_DELAY = 30000; // 30 seconds

    try {
        const options = {
            method: 'GET',
            url: `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=18350`,
            headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
        };
        console.log('the options are: ', options)
        
        Logger.info(`Attempting to fetch user data for FID: ${fid} (Attempt ${retryCount + 1})`);
        const response = await axios.request(options);
        Logger.info(`Successfully fetched user data for FID: ${fid}`);
        return response.data.users[0];
    } catch (error) {
        console.log("The error is: ", error)
        Logger.error(`Error fetching user from FID ${fid} (Attempt ${retryCount + 1}):`, error.message);

        if (retryCount < MAX_RETRIES - 1) {
            const isNetworkError = error.code === 'EAI_AGAIN' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
            
            if (isNetworkError) {
                const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
                Logger.warn(`Network error detected. Retrying in ${delay/1000} seconds... (${MAX_RETRIES - retryCount - 1} attempts left)`);
                await sleep(delay);
                return getUserFromFid(fid, retryCount + 1);
            } else {
                Logger.error(`Non-network error encountered:`, error);
                throw error; // If it's not a network error, throw immediately
            }
        } else {
            Logger.error(`Max retries (${MAX_RETRIES}) reached for FID ${fid}. Giving up.`);
            throw new Error(`Failed to fetch user data after ${MAX_RETRIES} attempts: ${error.message}`);
        }
    }
}