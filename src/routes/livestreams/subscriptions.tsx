import { getUserFromFid, getUserFromUsername } from "../../../utils/farcaster";
import prisma from "../../../utils/prismaClient";

export async function getSubscribersOfStreamer(streamerFid: string): Promise<string[]> {
  const subscriptions = await prisma.subscription.findMany({
    where: { streamerFid: streamerFid },
    select: { subscriberFid: true }
  });
  return subscriptions.map(sub => sub.subscriberFid);
}

export async function checkIfUserSubscribed(streamer: string, userFid: string | number) {
    try {
      if(!userFid) return false
      const streamerData = await getUserFromUsername(streamer)
      console.log("inside the checking if the user is subscribed", streamerData, userFid)
      const subscription = await prisma.subscription.findFirst({
        where: {
          subscriberFid: userFid.toString(),
          streamerFid: streamerData.fid.toString()
        }
      });
      return !!subscription;
    } catch (error) {
      console.error("Error checking user subscription:", error);
      return false;
    }
  }

  export async function subscribeUserToStreamer(streamer: string, userFid: string | number) {
    try {
      if(!userFid) return false
      let user = await prisma.user.findUnique({ where: { fid: userFid.toString() } });
      if (!user) {
        const userData = await getUserFromFid(+userFid);
        if (!userData) {
          throw new Error("User not found on Farcaster");
        }
        user = await prisma.user.create({
          data: {
            fid: userData.fid.toString(),
            username: userData.username,
            displayName: userData.display_name,
            pfpUrl: userData.pfp_url
          }
        });
      }
  
      let streamerUser = await prisma.user.findUnique({ where: { username: streamer } });
      if (!streamerUser) {
        const streamerData = await getUserFromUsername(streamer);
        if (!streamerData) {
          throw new Error("Streamer not found on Farcaster");
        }
        streamerUser = await prisma.user.create({
          data: {
            fid: streamerData.fid.toString(),
            username: streamerData.username,
            displayName: streamerData.displayName,
            pfpUrl: streamerData.pfp.url
          }
        });
      }
  
      const subscription = await prisma.subscription.create({
        data: {
          subscriber: { connect: { fid: user.fid.toString() } },
          streamer: { connect: { fid: streamerUser.fid.toString() } }
        }
      });
  
      return { success: true, subscription };
    } catch (error) {
      console.error("Error subscribing user to streamer:", error);
      return { success: false, error: error.message };
    }
  }
  
  export async function unsubscribeUserFromStreamer(streamer: string, userFid: string | number) {
    try {
      if(!userFid) return false
      const user = await prisma.user.findUnique({ where: { fid: userFid.toString() } });
      if (!user) {
        throw new Error("User not found");
      }
  
      const streamerUser = await prisma.user.findUnique({ where: { username: streamer } });
      if (!streamerUser) {
        throw new Error("Streamer not found");
      }
  
      const deletedSubscription = await prisma.subscription.deleteMany({
        where: {
          subscriberFid: user.fid.toString(),
          streamerFid: streamerUser.fid.toString()
        }
      });
  
      return { success: deletedSubscription.count > 0 };
    } catch (error) {
      console.error("Error unsubscribing user from streamer:", error);
      return { success: false, error: error.message };
    }
  }