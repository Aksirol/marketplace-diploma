import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Середовище виконання тестів
    environment: 'node',

    // Файл з глобальними налаштуваннями (підключення .env.test)
    setupFiles: ['./src/__tests__/setup.ts'],

    // Запускаємо тести послідовно — важливо, бо вони залежать від БД
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/seed.ts', 'src/index.ts'],
    },
  },
});
