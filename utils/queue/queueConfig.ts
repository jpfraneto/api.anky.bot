// queueConfig.ts
import { Queue, Worker, Job } from 'bullmq';
import { REDIS_URL } from '../../env/server-env';
import { processClipJob } from '../../src/routes/livestreams/clips';
import  Redis from 'ioredis';


const redis = new Redis({
  maxRetriesPerRequest: null,
  host: REDIS_URL
});

export const clipQueue = new Queue('clip-creation', { 
  connection: redis 
});

export const setupWorkers = () => {
  const worker = new Worker('clip-creation', processClipJob, { 
    connection: redis 
  });

  worker.on('completed', job => {
    console.log(`Job ${job.id} has completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });

  return worker;
};