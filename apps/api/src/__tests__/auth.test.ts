import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { app } from '../app';

const prisma = new PrismaClient();

describe('Authentication & Authorization Flow', () => {
  // Унікальний email для кожного запуску тестів
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let buyerToken = '';

  afterAll(async () => {
    // Прибираємо за собою після тестів
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it('bcrypt: хеш різний при однакових паролях (через сіль)', async () => {
    const hash1 = await bcrypt.hash('my_password', 12);
    const hash2 = await bcrypt.hash('my_password', 12);
    
    expect(hash1).not.toBe(hash2); // Хеші мають відрізнятися
    
    // Але обидва мають проходити перевірку
    const isValid1 = await bcrypt.compare('my_password', hash1);
    const isValid2 = await bcrypt.compare('my_password', hash2);
    
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('Реєстрація: успішна реєстрація нового користувача', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: testPassword,
      first_name: 'Тест',
      role: 'USER',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('tokens');
  });

  it('Реєстрація: дублікат email повертає 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SomeOtherPassword',
      role: 'USER',
    });

    expect(res.status).toBe(409);
  });

  it('Логін: успішний вхід та отримання токенів', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    
    buyerToken = res.body.tokens.accessToken; // Зберігаємо для наступних тестів
  });

  it('Логін: невірний пароль повертає 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
  });

  it('JWT: некоректний токен повертає 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.string');

    expect(res.status).toBe(401);
  });

  it('roleGuard: buyer не має доступу до роуту producer (повертає 403)', async () => {
    // Наш покупець (buyerToken) намагається зайти на маршрут виробника
    const res = await request(app)
      .get('/api/auth/producer-only')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('У вас немає прав для виконання цієї дії.');
  });
});