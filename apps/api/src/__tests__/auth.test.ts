import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { app } from '../app';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

describe('Authentication & Authorization Flow (Buyer Module)', () => {
  const testEmail = `buyer-${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  let verifyToken = '';
  let buyerToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    // Підключаємо Redis і очищаємо його перед тестами
    if (!redisClient.isOpen) await redisClient.connect();
    await redisClient.flushAll();
  });

  afterAll(async () => {
    // Прибираємо тестового користувача з БД
    await prisma.user.deleteMany({ where: { email: testEmail } });

    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('bcrypt: хеш різний при однакових паролях (через сіль)', async () => {
    const hash1 = await bcrypt.hash('my_password', 12);
    const hash2 = await bcrypt.hash('my_password', 12);

    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare('my_password', hash1)).toBe(true);
  });

  it('Реєстрація: is_active = false до підтвердження (створення токена)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: testPassword,
      first_name: 'Покупець',
      role: 'USER',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Перевірте email');

    // Перевіряємо в базі даних, що акаунт дійсно неактивний
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeDefined();
    expect(user?.is_active).toBe(false);

    // Знаходимо згенерований токен верифікації в Redis
    // (Оскільки ми робили flushAll(), ключ verify:* буде тільки один)
    const keys = await redisClient.keys('verify:*');
    expect(keys.length).toBe(1);

    verifyToken = keys[0].replace('verify:', ''); // Зберігаємо токен для наступних тестів
  });

  it('Логін без верифікації email → 403', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Акаунт не підтверджено. Перевірте email.');
  });

  it('Протермінований або невірний verify-токен → 400', async () => {
    const res = await request(app).get('/api/auth/verify/invalid-token-12345');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Недійсний або прострочений токен підтвердження');
  });

  it('Успішна верифікація email', async () => {
    // Використовуємо правильний токен, який ми витягнули з Redis
    const res = await request(app).get(`/api/auth/verify/${verifyToken}`);

    expect(res.status).toBe(200);

    // Перевіряємо, що в БД статус змінився на true
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.is_active).toBe(true);

    // Перевіряємо, що токен успішно видалився з Redis після використання
    const exists = await redisClient.get(`verify:${verifyToken}`);
    expect(exists).toBeNull();
  });

  it('Логін: успішний вхід та отримання токенів', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');

    buyerToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('JWT: некоректний токен доступу повертає 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.string');

    expect(res.status).toBe(401);
  });

  it('roleGuard: buyer не має доступу до роуту producer (повертає 403)', async () => {
    const res = await request(app)
      .get('/api/auth/producer-only')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(403);
  });

  it('Logout: refresh-токен не працює після виходу (Blacklist у Redis)', async () => {
    // 1. Робимо логаут
    const logoutRes = await request(app).post('/api/auth/logout').send({
      refreshToken,
    });
    expect(logoutRes.status).toBe(200);

    // 2. Перевіряємо наявність токена в Blacklist у Redis
    const isBlacklisted = await redisClient.get(`bl:${refreshToken}`);
    expect(isBlacklisted).toBe('revoked');

    // 3. Спроба оновити токен за допомогою анульованого refreshToken
    const refreshRes = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.message).toContain('анульовано');
  });
});