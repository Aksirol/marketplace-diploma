import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { app } from '../app';
import { redisClient } from '../lib/redis';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Buyer Activity Flow (Orders, Wishlist, Cart Merge)', () => {
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;
  let userBEmail: string;

  let productId: string;
  let storeId: string;

  let orderA_New_Id: string;
  let orderA_Shipped_Id: string;

  // Використовуємо agent для збереження cookies (сесії гостя) між запитами
  const guestAgent = request.agent(app);

  beforeAll(async () => {
    if (!redisClient.isOpen) await redisClient.connect();
    await redisClient.flushAll(); // Очищаємо Redis перед тестом

    const passHash = await bcrypt.hash('Password123!', 10);

    // 1. Створюємо двох користувачів
    const userA = await prisma.user.create({
      data: { email: `buyer-a-${Date.now()}@test.com`, password_hash: passHash, first_name: 'Buyer A', is_active: true }
    });
    userAId = userA.id;
    userAToken = jwt.sign({ id: userAId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    userBEmail = `buyer-b-${Date.now()}@test.com`;
    const userB = await prisma.user.create({
      data: { email: userBEmail, password_hash: passHash, first_name: 'Buyer B', is_active: true }
    });
    userBId = userB.id;
    userBToken = jwt.sign({ id: userBId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    // 2. Створюємо тестовий магазин та товар
    const store = await prisma.store.create({
      data: { user_id: userAId, name: 'Store A', status: 'ACTIVE' }
    });
    storeId = store.id;

    const category = await prisma.category.create({
      data: { name: 'Cat', slug: `cat-${Date.now()}` }
    });

    const product = await prisma.product.create({
      data: { store_id: storeId, category_id: category.id, name: 'Product A', price: 100, stock_qty: 10 }
    });
    productId = product.id;

    // 3. Створюємо два замовлення для Користувача А (Одне NEW, інше SHIPPED)
    const orderNew = await prisma.order.create({
      data: {
        buyer_id: userAId, store_id: storeId, total_amount: 100, delivery_method: 'NP', payment_method: 'Card', status: OrderStatus.NEW,
        items: { create: [{ product_id: productId, quantity: 1, unit_price: 100 }] }
      }
    });
    orderA_New_Id = orderNew.id;

    const orderShipped = await prisma.order.create({
      data: {
        buyer_id: userAId, store_id: storeId, total_amount: 100, delivery_method: 'NP', payment_method: 'Card', status: OrderStatus.SHIPPED,
        items: { create: [{ product_id: productId, quantity: 1, unit_price: 100 }] }
      }
    });
    orderA_Shipped_Id = orderShipped.id;
  });

  afterAll(async () => {
    // Очищення бази даних після тестів
    await prisma.orderItem.deleteMany({ where: { order: { store_id: storeId } } });
    await prisma.order.deleteMany({ where: { store_id: storeId } });
    await prisma.wishlist.deleteMany({ where: { user_id: { in: [userAId, userBId] } } });
    await prisma.product.deleteMany({ where: { store_id: storeId } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: 'cat-' } } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });

    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Безпека: Спроба скасувати замовлення іншого покупця → 403', async () => {
    // Користувач B намагається скасувати замовлення Користувача A
    const res = await request(app)
      .post(`/api/orders/${orderA_New_Id}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Доступ заборонено. Це не ваше замовлення.');
  });

  it('Валідація: Скасування shipped-замовлення → 400', async () => {
    // Користувач A намагається скасувати своє замовлення, але воно вже В ДОРОЗІ
    const res = await request(app)
      .post(`/api/orders/${orderA_Shipped_Id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Неможливо скасувати замовлення зі статусом SHIPPED');
  });

  it('Успішне скасування свого NEW замовлення', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderA_New_Id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELED');
  });

  it('Вішліст: Додавання товару та отримання списку', async () => {
    const addRes = await request(app)
      .post('/api/users/me/wishlist')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId });
    expect(addRes.status).toBe(201);

    const getRes = await request(app)
      .get('/api/users/me/wishlist')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].product_id).toBe(productId);
  });

  it('Merge кошика: гостьовий кошик зберігається і сумується після входу, Redis очищається', async () => {
    // 1. Спочатку імітуємо, що Користувач B вже мав 1 такий товар у своєму акаунті (в Redis)
    const initialUserCart = { items: [{ productId, quantity: 1 }] };
    await redisClient.set(`cart:${userBId}`, JSON.stringify(initialUserCart));

    // 2. Гість (без авторизації, але з cookie сесії) додає 2 таких самих товари в кошик
    const cartRes = await guestAgent.post('/api/cart').send({ productId, quantity: 2 });
    expect(cartRes.status).toBe(200);

    // Витягуємо session_id з кукі, щоб потім перевірити його видалення
    const cookies = cartRes.headers['set-cookie'];
    const sessionIdMatch = cookies[0].match(/session_id=([^;]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : '';

    // Переконуємось, що гостьовий кошик створився в Redis
    const guestRedisCart = await redisClient.get(`cart:${sessionId}`);
    expect(guestRedisCart).not.toBeNull();

    // 3. Гість логіниться в акаунт Користувача B
    const loginRes = await guestAgent.post('/api/auth/login').send({
      email: userBEmail,
      password: 'Password123!'
    });
    expect(loginRes.status).toBe(200);
    const tokenB = loginRes.body.tokens.accessToken;

    // 4. Перевіряємо об'єднаний кошик (через токен)
    const mergedCartRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mergedCartRes.status).toBe(200);
    // Кількість має СУМУВАТИСЯ: 1 (було в акаунті) + 2 (додав гість) = 3
    expect(mergedCartRes.body.items[0].quantity).toBe(3);

    // 5. Перевіряємо, що після логіну Redis-кошик гостя очищено
    const clearedGuestCart = await redisClient.get(`cart:${sessionId}`);
    expect(clearedGuestCart).toBeNull();
  });
});