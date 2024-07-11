import axios from "axios";
import { sleep } from "./time";
import { NEYNAR_API_KEY } from "../env/server-env";

export async function getUserFromFid (fid: number) {
    try {
        const options = {
            method: 'GET',
            url: `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
            headers: {accept: 'application/json', api_key: NEYNAR_API_KEY}
          };
        const response = await axios.request(options)
        return response.data.users[0]
    } catch (error) {
        console.log("there was an error fetching the user from fid", error)
        await sleep(1000)
        getUserFromFid(fid)
    }
}