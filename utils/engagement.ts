const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
import { fetchCastInformationFromHash } from './cast'
import { Cast } from './types/cast';

export async function calculateEngagement() {
  const replies = await prisma.replyFromAnky.findMany({
    where: {
      scheduledAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setHours(24, 0, 0, 0))
      }
    }
  });

  let totalEngagementScore = 0;

  for (const reply of replies) {
    // Fetch engagement data from Farcaster API
    if(!reply || !reply.hash) continue
    const cast = await fetchCastInformationFromHash(reply.replyCastHash);
    const engagementForThisCast = await calculateCastEngagementScoreFromCast(cast);
    // TODO : UPDATE THE CAST WITH THE INFORMATION
  }
  // TODO : UPDATE THE DAY WITH THE ENGAGEMENT DATA OF THE WHOLE DAY
}

export async function calculateCastEngagementScoreFromCast (cast: Cast){
  return Math.random().toFixed(2)
}