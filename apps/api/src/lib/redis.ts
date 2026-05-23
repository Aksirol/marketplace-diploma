import { createClient } from 'redis';

// Якщо ми в Docker - використовуємо REDIS_URL, якщо локально (тести) - localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl
});

redisClient.on('error', (err) => console.error('Помилка Redis Client', err));
redisClient.on('connect', () => console.log('✅ Підключено до Redis'));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};