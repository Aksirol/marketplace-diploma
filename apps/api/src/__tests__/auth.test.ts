import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { app } from '../app';

const prisma = new PrismaClient();

describe('Authentication & Authorization Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let buyerToken = '';

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, `blocked-${testEmail}`] } } });
    await prisma.$disconnect();
  });

  // ─── bcrypt ───────────────────────────────────────────────

  it('bcrypt: однаковий пароль дає різні хеші (через сіль)', async () => {
    const hash1 = await bcrypt.hash('my_password', 12);
    const hash2 = await bcrypt.hash('my_password', 12);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare('my_password', hash1)).toBe(true);
    expect(await bcrypt.compare('my_password', hash2)).toBe(true);
  });

  // ─── Реєстрація ───────────────────────────────────────────

  it('Реєстрація: успішна реєстрація повертає 201 і токени', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: testPassword,
      first_name: 'Тест',
      role: 'USER',
    });
    expect(res.status).toBe(201);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
  });

  it('Реєстрація: дублікат email повертає 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SomeOtherPassword123!',
      role: 'USER',
    });
    expect(res.status).toBe(409);
  });

  it('Реєстрація: некоректний email повертає 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: testPassword,
    });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('errors');
  });

  it('Реєстрація: пароль коротший 8 символів повертає 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `short-${testEmail}`,
      password: '123',
    });
    expect(res.status).toBe(422);
    expect(res.body.errors?.password).toBeDefined();
  });

  it('Реєстрація: порожній body повертає 422', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
  });

  it('Реєстрація: роль ADMIN через форму повертає 422 (захист)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `admin-try-${testEmail}`,
      password: testPassword,
      role: 'ADMIN',
    });
    // Zod відхиляє недозволену роль
    expect(res.status).toBe(422);
  });

  // ─── Логін ────────────────────────────────────────────────

  it('Логін: успішний вхід повертає 200 і токени', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    buyerToken = res.body.tokens.accessToken;
  });

  it('Логін: невірний пароль повертає 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
  });

  it('Логін: неіснуючий email повертає 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: testPassword,
    });
    expect(res.status).toBe(401);
  });

  it('Логін: заблокований акаунт повертає 403', async () => {
    // Створюємо заблокованого юзера напряму в БД
    const blockedEmail = `blocked-${testEmail}`;
    await prisma.user.create({
      data: {
        email: blockedEmail,
        password_hash: await bcrypt.hash(testPassword, 12),
        role: 'USER',
        is_active: false, // Заблокований
      },
    });

    const res = await request(app).post('/api/auth/login').send({
      email: blockedEmail,
      password: testPassword,
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/заблоковано/i);
  });

  // ─── JWT / Middleware ──────────────────────────────────────

  it('JWT: некоректний токен повертає 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.string');
    expect(res.status).toBe(401);
  });

  it('JWT: відсутній токен повертає 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('roleGuard: USER не має доступу до маршруту PRODUCER (повертає 403)', async () => {
    const res = await request(app)
      .get('/api/auth/producer-only')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  it('Захищений маршрут /me повертає дані користувача з валідним токеном', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('role', 'USER');
  });
});
