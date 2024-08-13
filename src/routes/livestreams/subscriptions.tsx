import prisma from "../../../utils/prismaClient";

export async function checkIfUserSubscribed(streamer: string, userFid: string | number) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          subscriber: { fid: userFid.toString() },
          streamer: { username: streamer }
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
      const user = await prisma.user.findUnique({ where: { fid: userFid.toString() } });
      const streamerUser = await prisma.user.findUnique({ where: { username: streamer } });
  
      if (!user || !streamerUser) {
        throw new Error("User or streamer not found");
      }
  
      const subscription = await prisma.subscription.create({
        data: {
          subscriber: { connect: { id: user.id } },
          streamer: { connect: { id: streamerUser.id } }
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
      const user = await prisma.user.findUnique({ where: { fid: userFid.toString() } });
      const streamerUser = await prisma.user.findUnique({ where: { username: streamer } });
  
      if (!user || !streamerUser) {
        throw new Error("User or streamer not found");
      }
  
      const deletedSubscription = await prisma.subscription.deleteMany({
        where: {
          subscriberId: user.id,
          streamerId: streamerUser.id
        }
      });
  
      return { success: deletedSubscription.count > 0 };
    } catch (error) {
      console.error("Error unsubscribing user from streamer:", error);
      return { success: false, error: error.message };
    }
  }