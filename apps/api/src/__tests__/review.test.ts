import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import { app } from '../app';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Product Reviews Flow (Phase 3.4)', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  let productId: string;
  let storeId: string;

  let orderA_New_Id: string;
  let orderA_Delivered_Id: string;
  let orderB_Delivered_Id: string;

  beforeAll(async () => {
    // 1. Створюємо двох покупців
    const userA = await prisma.user.create({
      data: { email: `rev-a-${Date.now()}@test.com`, password_hash: 'hash', role: Role.USER }
    });
    userAId = userA.id;
    userAToken = jwt.sign({ id: userAId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    const userB = await prisma.user.create({
      data: { email: `rev-b-${Date.now()}@test.com`, password_hash: 'hash', role: Role.USER }
    });
    userBId = userB.id;
    userBToken = jwt.sign({ id: userBId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    // 2. Створюємо тестовий магазин і товар
    const store = await prisma.store.create({
      data: { user_id: userAId, name: 'Review Store', status: 'ACTIVE' }
    });
    storeId = store.id;

    const category = await prisma.category.create({
      data: { name: 'RevCat', slug: `revcat-${Date.now()}` }
    });

    const product = await prisma.product.create({
      data: { store_id: storeId, category_id: category.id, name: 'Awesome Product', price: 100, stock_qty: 10, average_rating: 0 }
    });
    productId = product.id;

    // 3. Створюємо замовлення для тестів
    // Замовлення А - ще НЕ доставлене (NEW)
    const order1 = await prisma.order.create({
      data: {
        buyer_id: userAId, store_id: storeId, total_amount: 100, delivery_method: 'NP', payment_method: 'Card', status: OrderStatus.NEW,
        items: { create: [{ product_id: productId, quantity: 1, unit_price: 100 }] }
      }
    });
    orderA_New_Id = order1.id;

    // Замовлення А - ДОСТАВЛЕНЕ
    const order2 = await prisma.order.create({
      data: {
        buyer_id: userAId, store_id: storeId, total_amount: 100, delivery_method: 'NP', payment_method: 'Card', status: OrderStatus.DELIVERED,
        items: { create: [{ product_id: productId, quantity: 1, unit_price: 100 }] }
      }
    });
    orderA_Delivered_Id = order2.id;

    // Замовлення B - ДОСТАВЛЕНЕ (для іншого юзера)
    const order3 = await prisma.order.create({
      data: {
        buyer_id: userBId, store_id: storeId, total_amount: 100, delivery_method: 'NP', payment_method: 'Card', status: OrderStatus.DELIVERED,
        items: { create: [{ product_id: productId, quantity: 1, unit_price: 100 }] }
      }
    });
    orderB_Delivered_Id = order3.id;
  });

  afterAll(async () => {
    // Очищаємо базу в правильному порядку (відгуки першими через зовнішні ключі)
    await prisma.review.deleteMany({ where: { product_id: productId } });
    await prisma.orderItem.deleteMany({ where: { order: { store_id: storeId } } });
    await prisma.order.deleteMany({ where: { store_id: storeId } });
    await prisma.product.deleteMany({ where: { store_id: storeId } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: 'revcat-' } } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  it('Логіка допуску: Відгук на чуже замовлення (або без покупки) → 403', async () => {
    // Юзер А намагається залишити відгук по замовленню Юзера B
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ order_id: orderB_Delivered_Id, product_id: productId, rating: 5, comment: 'Супер!' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Це не ваше замовлення');
  });

  it('Логіка допуску: Відгук на замовлення, що ще не доставлене → 400', async () => {
    // Юзер А залишає відгук на своє NEW замовлення
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ order_id: orderA_New_Id, product_id: productId, rating: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('лише після отримання');
  });

  it('E2E: Замовлення DELIVERED → успішний відгук', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ order_id: orderA_Delivered_Id, product_id: productId, rating: 5, comment: 'Ідеально!' });

    expect(res.status).toBe(201);
  });

  it('Логіка допуску: Другий відгук на той самий товар у тому ж замовленні → 400 (Дублікат)', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ order_id: orderA_Delivered_Id, product_id: productId, rating: 1, comment: 'Хочу ще один відгук!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Ви вже залишили відгук');
  });

  it('Транзакція: Рейтинг товару коректно перераховується після відгуків', async () => {
    // Після відгуку Юзера А (на 5 зірок), середній рейтинг має бути 5
    let product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.average_rating).toBe(5);

    // Юзер B залишає свій відгук (на 3 зірки) зі свого замовлення
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ order_id: orderB_Delivered_Id, product_id: productId, rating: 3 });

    // (5 + 3) / 2 = 4. Середній рейтинг має оновитися до 4
    product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.average_rating).toBe(4);
  });
});