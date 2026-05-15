import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../app';

const prisma = new PrismaClient();

describe('System & Health Checks', () => {
  // Закриваємо з'єднання з БД після завершення всіх тестів
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health - повинен повертати 200 та версію API', async () => {
    // Робимо віртуальний запит до нашого додатку
    const response = await request(app).get('/api/health');

    // Перевіряємо статус і тіло відповіді
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body).toHaveProperty('version', '1.0.0');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('Prisma - повинна підключатися до БД без помилок', async () => {
    // Виконуємо найпростіший SQL запит для перевірки з'єднання (SELECT 1)
    const result = await prisma.$queryRaw`SELECT 1 as result`;

    // Перевіряємо, що ми отримали результат і він дорівнює 1
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect((result as any)[0].result).toBe(1);
  });
});