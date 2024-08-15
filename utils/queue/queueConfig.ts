import { Queue, Worker, Job } from 'bullmq';
import { REDIS_URL } from '../../env/server-env';
import { processClipJob } from '../../src/routes/livestreams/clips';
import Redis from 'ioredis';

// Parse the Redis URL
const parsedRedisUrl = new URL(REDIS_URL);

const redisOptions = {
  host: parsedRedisUrl.hostname,
  port: parseInt(parsedRedisUrl.port, 10),
  username: parsedRedisUrl.username,
  password: parsedRedisUrl.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: parsedRedisUrl.protocol === 'rediss:' ? {} : undefined,
};

const redis = new Redis(redisOptions);

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