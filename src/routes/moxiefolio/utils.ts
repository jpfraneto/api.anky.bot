import prisma from "../../../utils/prismaClient";

type MoxieFantokenEntry = {
  targetUser: {
    username: string;
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

export async function updateMoxieFantokenEntry(userId: number, targetUsername: string, newAllocation: number) {
  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await tx.user.create({ data: { id: userId, username: `user_${userId}` } });
    }

    let targetUser = await tx.user.findUnique({ where: { username: targetUsername } });
    if (!targetUser) {
      targetUser = await tx.user.create({ data: { username: targetUsername } });
    }

    let moxieFantokens = await tx.moxieFantoken.findUnique({ 
      where: { userId },
      include: { entries: true }
    });

    if (!moxieFantokens) {
      moxieFantokens = await tx.moxieFantoken.create({
        data: { userId, totalAllocated: 0 }
      });
    }

    const existingEntry = moxieFantokens.entries.find(e => e.targetUserId === targetUser.id);
    const oldAllocation = existingEntry ? existingEntry.allocation : 0;
    const allocationDiff = newAllocation - oldAllocation;

    if (moxieFantokens.totalAllocated + allocationDiff > 100) {
      // Redistribute allocation
      const availableAllocation = 100 - (moxieFantokens.totalAllocated + allocationDiff);
      const redistributionFactor = availableAllocation / moxieFantokens.totalAllocated;

      for (const entry of moxieFantokens.entries) {
        if (entry.targetUserId !== targetUser.id) {
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
          targetUserId: targetUser.id,
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
              select: { username: true, id: true }
            }
          }
        }
      }
    });
  });
}