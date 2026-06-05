import dotenv from 'dotenv';
// ВАЖЛИВО: Завантажуємо .env до того, як імпортувати інші модулі
dotenv.config();

import { app } from './app';
import { connectRedis } from './lib/redis';

const PORT = process.env.API_PORT || 4000;

// Обробляємо помилку підключення, щоб сервер не "крашився" (socket hang up)
connectRedis().catch((err) => {
  console.error('❌ Не вдалося підключитися до Redis. Перевірте, чи запущений Docker:', err.message);
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});