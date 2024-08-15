import axios from "axios";
import { JPFRANETO_WARPCAST_API_KEY, VIBRA_SO_WARPCAST_API_KEY } from "../../../env/server-env";
import prisma from "../../../utils/prismaClient";
import { v4 as uuidv4 } from 'uuid';


export async function sendProgrammaticDmToSubscribers(subscribers: string[], streamerFid: string, streamTitle: string, streamCastHash: string) {
    try {
      console.log("Sending programmatic DCs to subscribers:", subscribers);
      const streamer = await prisma.user.findUnique({ where: { fid: streamerFid } });
      
      if (!streamer) {
        console.error("Streamer not found in database");
        return;
      }
  
      const sendDirectCast = async (subscriberFid: string) => {
        const uuid = uuidv4();
        const directCastData = {
          recipientFid: subscriberFid,
          message: `🔴 Live Alert! 📺\n\n@${streamer.username} just went live on Vibra:\n"${streamTitle}"\n\nDon't miss out! Watch now:\nhttps://www.vibra.so/stream/${streamer.username}\n\nEnjoy the stream! 🎉\n\nhttps://www.warpcast.com/${streamer.username}/${streamCastHash.slice(0,10)}`,
          idempotencyKey: uuid
        };
  
        try {
          const response = await axios.put('https://api.warpcast.com/v2/ext-send-direct-cast', directCastData, {
            headers: {
              'Authorization': `Bearer ${JPFRANETO_WARPCAST_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
  
          if (response.data.result.success) {
            console.log(`Direct Cast sent successfully to subscriber ${subscriberFid}`);
          } else {
            console.error(`Failed to send Direct Cast to subscriber ${subscriberFid}:`, response.data);
          }
        } catch (error) {
          console.error(`Error sending Direct Cast to subscriber ${subscriberFid}:`, error);
        }
      };
  
      // Use Promise.all to send all Direct Casts concurrently
      await Promise.all(subscribers.map(subscriberFid => sendDirectCast(subscriberFid)));
  
      console.log("All Direct Casts have been sent");
    } catch (error) {
      console.error("Error in sendProgrammaticDmToSubscribers:", error);
    }
  }