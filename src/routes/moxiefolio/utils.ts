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


export async function getUserMoxieFantokens(userId: number){
  const response = await prisma.moxieFantokens.findUnique({
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
  })
  return response
}

export async function updateMoxieFantokenEntry(userId: number, targetUsername: string, newAllocation: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
  if (!targetUser) throw new Error('Target user not found');

  return prisma.$transaction(async (tx) => {
    let moxieFantokens = await tx.moxieFantokens.findUnique({ 
      where: { userId },
      include: { entries: true }
    });

    if (!moxieFantokens) {
      moxieFantokens = await tx.moxieFantokens.create({
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

    return tx.moxieFantokens.update({
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