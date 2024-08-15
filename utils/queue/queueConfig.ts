// queueConfig.ts
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_URL } from '../../env/server-env';
import { processClipJob } from '../../src/routes/livestreams/clips';


const connection = new Redis(REDIS_URL);

export const clipQueue = new Queue('clip-creation', { connection });

export const setupWorkers = () => {
  const clipWorker = new Worker('clip-creation', async (job: Job) => {
    await processClipJob(job);
  }, { connection });

  clipWorker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed`);
  });

  clipWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });
};
