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

export async function getUserMoxieFantokens(userFid: number) {
  const response = await prisma.moxieFantoken.findUnique({
    where: { userFid },
    include: {
      entries: {
        include: {
          targetUser: {
            select: { username: true, fid: true }
          }
        }
      }
    }
  });
  return response;
}

export async function updateMoxieFantokenEntry(userFid: number, targetFid: number, newAllocation: number) {
  return prisma.$transaction(async (tx) => {
    // Fetch user data from Farcaster
    const userData = await getUserFromFid(userFid);
    const targetUserData = await getUserFromFid(targetFid);

    // Upsert main user
    let user = await tx.user.upsert({
      where: { fid: userFid },
      update: { username: userData.username },
      create: { fid: userFid, username: userData.username }
    });

    // Upsert target user
    let targetUser = await tx.user.upsert({
      where: { fid: targetFid },
      update: { username: targetUserData.username },
      create: { fid: targetFid, username: targetUserData.username }
    });

    let moxieFantokens = await tx.moxieFantoken.findUnique({ 
      where: { userFid },
      include: { entries: true }
    });

    if (!moxieFantokens) {
      moxieFantokens = await tx.moxieFantoken.create({
        data: { userFid, totalAllocated: 0 }
      });
    }

    const existingEntry = moxieFantokens.entries.find(e => e.targetUserFid === targetFid);
    const oldAllocation = existingEntry ? existingEntry.allocation : 0;
    const allocationDiff = newAllocation - oldAllocation;

    if (moxieFantokens.totalAllocated + allocationDiff > 100) {
      // Redistribute allocation
      const availableAllocation = 100 - (moxieFantokens.totalAllocated + allocationDiff);
      const redistributionFactor = availableAllocation / moxieFantokens.totalAllocated;

      for (const entry of moxieFantokens.entries) {
        if (entry.targetUserFid !== targetFid) {
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
          moxieFantokensId: moxieFantokens.id,
          targetUserFid: targetFid,
          allocation: newAllocation
        }
      });
    }

    return tx.moxieFantoken.update({
      where: { id: moxieFantokens.id },
      data: { totalAllocated: { increment: allocationDiff } },
      include: {
        entries: {
          include: {
            targetUser: {
              select: { username: true, fid: true }
            }
          }
        }
      }
    });
  });
}