import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { app } from '../app';
import { redisClient } from '../lib/redis';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Допоміжна функція для генерації валідного токена для тестів
const generateTestToken = (userId: string, role: Role) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'secret';
  return jwt.sign({ id: userId, role }, secret, { expiresIn: '15m' });
};

describe('User Profile & Addresses Flow', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userAAddressId: string;

  beforeAll(async () => {
    if (!redisClient.isOpen) await redisClient.connect();

    // Створюємо двох незалежних користувачів
    const passHash = await bcrypt.hash('Password123!', 10);

    const userA = await prisma.user.create({
      data: {
        email: `usera-${Date.now()}@test.com`,
        password_hash: passHash,
        first_name: 'Олексій',
        is_active: true,
      }
    });
    userAId = userA.id;
    userAToken = generateTestToken(userA.id, userA.role);

    const userB = await prisma.user.create({
      data: {
        email: `userb-${Date.now()}@test.com`,
        password_hash: passHash,
        first_name: 'Марія',
        is_active: true,
      }
    });
    userBId = userB.id;
    userBToken = generateTestToken(userB.id, userB.role);
  });

  afterAll(async () => {
    // Очищуємо дані
    await prisma.userAddress.deleteMany({ where: { user_id: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });

    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('PUT /api/users/me без токену → 401 Unauthorized', async () => {
    const res = await request(app).put('/api/users/me').send({
      first_name: 'Хакер'
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Немає доступу. Токен відсутній.');
  });

  it('Checkpoint: профіль успішно редагується і зберігається', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        first_name: 'Олексій Оновлений',
        phone: '+380991112233'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Профіль успішно оновлено');
    expect(res.body.user.first_name).toBe('Олексій Оновлений');
    expect(res.body.user.phone).toBe('+380991112233');
  });

  it('Зміна пароля: невірний старий пароль → 400', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        oldPassword: 'WrongPassword!',
        newPassword: 'NewPassword123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Поточний пароль вказано невірно');
  });

  it('Зміна пароля: успішна зміна при правильному старому паролі', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        oldPassword: 'Password123!', // Той, що ми задали в beforeAll
        newPassword: 'NewPassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Пароль успішно змінено');
  });

  it('Адреси: Створення адреси для Користувача А', async () => {
    const res = await request(app)
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Дім',
        city: 'Київ',
        street: 'Хрещатик 1',
        zip_code: '01001'
      });

    expect(res.status).toBe(201);
    expect(res.body.city).toBe('Київ');

    userAAddressId = res.body.id; // Зберігаємо ID для перевірки ізоляції
  });

  it('Адреси: інший користувач (B) не бачить чужі адреси (A)', async () => {
    const res = await request(app)
      .get('/api/users/me/addresses')
      .set('Authorization', `Bearer ${userBToken}`); // Запит від Користувача B

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Користувач B щойно створений, у нього не має бути жодної адреси
    expect(res.body.length).toBe(0);
  });

  it('Адреси (Безпека): Користувач B не може видалити адресу Користувача A → 404', async () => {
    const res = await request(app)
      .delete(`/api/users/me/addresses/${userAAddressId}`)
      .set('Authorization', `Bearer ${userBToken}`); // Хакерська спроба від B

    // Наш бекенд шукає адресу за ID + user_id. Якщо не знайдено — повертає 404
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Адресу не знайдено або доступ заборонено');
  });
});