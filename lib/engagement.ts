const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

async function calculateEngagement() {
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
    const engagementData = await fetchEngagementData(reply.replyCastHash);
    const { quoteCasts, recasts, comments, likes } = engagementData;

    const engagementScore = (quoteCasts * 1.0) + (recasts * 0.8) + (comments * 0.6) + (likes * 0.4);

    await prisma.replyFromAnky.update({
      where: { id: reply.id },
      data: {
        quoteCasts,
        recasts,
        comments,
        likes,
        engagementScore
      }
    });

    totalEngagementScore += engagementScore;
  }

  const totalReplies = replies.length;

  await prisma.dailyPerformance.create({
    data: {
      date: new Date(),
      totalReplies,
      totalEngagementScore
    }
  });

  console.log('Daily performance metrics updated.');
}

async function fetchEngagementData() {
  // Placeholder function: replace with actual API call to fetch engagement data
  // Example:
  // const response = await axios.get(`https://farcaster/api/engagement?castHash=${replyCastHash}`);
  // return response.data;

  return {
    quoteCasts: Math.floor(Math.random() * 10),
    recasts: Math.floor(Math.random() * 10),
    comments: Math.floor(Math.random() * 10),
    likes: Math.floor(Math.random() * 10)
  };
}

calculateEngagement().catch((e) => {
  console.error(e);
  prisma.$disconnect();
}).finally(() => {
  prisma.$disconnect();
});
