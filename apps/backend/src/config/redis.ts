import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) return false; // stop retrying
      return 1000;
    },
  },
});

client.on('error', () => {
  // Redis is optional — silently ignore
});

// Export connectRedis function so index.ts can call it
export const connectRedis = async () => {
  try {
    await client.connect();
    console.log('Redis connected');
  } catch {
    console.log('Redis not available — running without cache');
  }
};

// Export getRedis for anywhere that uses the client
export const getRedis = () => client;

export default client;