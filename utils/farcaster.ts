import axios from "axios";
import { sleep } from "./time";
import { NEYNAR_API_KEY } from "../env/server-env";

export async function getUserFromFid(fid: number, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 5;

    try {
        const options = {
            method: 'GET',
            url: `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
            headers: { accept: 'application/json', api_key: NEYNAR_API_KEY }
        };
        const response = await axios.request(options);
        return response.data.users[0];
    } catch (error) {
        console.log(`Error fetching user from fid (attempt ${retryCount + 1}):`, error);

        if (retryCount < MAX_RETRIES - 1) {
            console.log(`Retrying in 1 second... (${MAX_RETRIES - retryCount - 1} attempts left)`);
            await sleep(1000);
            return getUserFromFid(fid, retryCount + 1);
        } else {
            console.log(`Max retries (${MAX_RETRIES}) reached. Throwing error.`);
            throw error;
        }
    }
}

export async function getUserFromUsername(username: string, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 5;

    try {

        const options = {
            method: 'GET',
            url: `https://api.neynar.com/v1/farcaster/user-by-username?username=${username}&viewerFid=16098`,
            headers: {accept: 'application/json', api_key: NEYNAR_API_KEY}
          };
          
        const response = await axios.request(options);
        return response.data.result.user;
    } catch (error) {
        console.log(`Error fetching user from fid (attempt ${retryCount + 1}):`, error);

        if (retryCount < MAX_RETRIES - 1) {
            console.log(`Retrying in 1 second... (${MAX_RETRIES - retryCount - 1} attempts left)`);
            await sleep(1000);
            return getUserFromUsername(username, retryCount + 1);
        } else {
            console.log(`Max retries (${MAX_RETRIES}) reached. Throwing error.`);
            throw error;
        }
    }
}

export function checkIfCastHasVideo (embedUrl : string) {
    console.log("THE EMBED URL IS: ", embedUrl)
    return embedUrl.includes('stream.warpcast.com') && embedUrl.slice(-5) == ".m3u8"
}