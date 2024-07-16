import prisma from "../../../utils/prismaClient";
import { getUserFromFid } from "../../../utils/farcaster";

type MoxieFantokenEntry = {
  targetUser: {
    username: string;
    fid: number;
  };
  allocation: number;
};

type MoxieFantokens = {
  entries: MoxieFantokenEntry[];
};

export async function getUserMoxieFantokens(userId: number) {
  const response = await prisma.moxieFantoken.findUnique({
    where: { userId },
    include: {
      entries: {
        include: {
          targetUser: {
            select: { username: true, id: true }
          }
        }
      }
    }
  });
  return response;
}

export async function updateMoxieFantokenEntry(userId: number, targetUserId: number, newAllocation: number) {
    return prisma.$transaction(async (tx) => {
      // Fetch user data from Farcaster
      const userData = await getUserFromFid(userId);
      const targetUserData = await getUserFromFid(targetUserId);
  
      // Upsert main user
      let user = await tx.user.upsert({
        where: { id: userId },
        update: { username: userData.username },
        create: { id: userId, username: userData.username }
      });
  
      // Upsert target user
      let targetUser = await tx.user.upsert({
        where: { id: targetUserId },
        update: { username: targetUserData.username },
        create: { id: targetUserId, username: targetUserData.username }
      });
  
      let moxieFantoken = await tx.moxieFantoken.findUnique({ 
        where: { userId },
        include: { entries: true }
      });
  
      if (!moxieFantoken) {
        moxieFantoken = await tx.moxieFantoken.create({
          data: { userId, totalAllocated: 0 }
        });
      }
  
      const existingEntry = moxieFantoken.entries?.find(e => e.targetUserId === targetUserId);
      const oldAllocation = existingEntry ? existingEntry.allocation : 0;
      const allocationDiff = newAllocation - oldAllocation;
  
      if (moxieFantoken.totalAllocated + allocationDiff > 100) {
        // Redistribute allocation
        const availableAllocation = 100 - (moxieFantoken.totalAllocated + allocationDiff);
        const redistributionFactor = availableAllocation / moxieFantoken.totalAllocated;
  
        for (const entry of moxieFantoken.entries) {
          if (entry.targetUserId !== targetUserId) {
            await tx.moxieFantokenEntry.update({
              where: { id: entry.id },
              data: { allocation: entry.allocation * redistributionFactor }
            });
          }
        }
      }
  
      if (existingEntry) {
        await tx.moxieFantokenEntry.update({
          where: { id: existingEntry.id },
          data: { allocation: newAllocation }
        });
      } else {
        await tx.moxieFantokenEntry.create({
          data: {
            moxieFantoken: { connect: { id: moxieFantoken.id } },
            targetUserId: targetUserId,
            allocation: newAllocation
          }
        });
      }
  
      return tx.moxieFantoken.update({
        where: { id: moxieFantoken.id },
        data: { 
          totalAllocated: { increment: allocationDiff },
          lastUpdated: new Date()
        },
        include: {
          entries: {
            include: {
              targetUser: {
                select: { username: true, id: true }
              }
            }
          }
        }
      });
    });
  }