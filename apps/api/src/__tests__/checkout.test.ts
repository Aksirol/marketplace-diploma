import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient, StoreStatus, Role } from '@prisma/client';
import { app } from '../app';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

describe('Checkout & Order Flow', () => {
  let productId: string;
  let storeId: string;
  let categoryId: string;
  let userId: string;
  let createdOrderId: string;

  // Агент для збереження сесії (cookies) між додаванням у кошик та чекаутом
  const agent = request.agent(app);

  beforeAll(async () => {
    if (!redisClient.isOpen) await redisClient.connect();

    // ОЧИЩАЄМО REDIS ВІД СТАРИХ ТЕСТІВ
    await redisClient.flushAll();

    // Підготовка тестових даних
    const user = await prisma.user.create({ data: { email: `checkout-${Date.now()}@test.com`, role: Role.PRODUCER } });
    userId = user.id;

    const store = await prisma.store.create({ data: { user_id: userId, name: 'Checkout Store', status: StoreStatus.ACTIVE } });
    storeId = store.id;

    const category = await prisma.category.create({ data: { name: 'Checkout Cat', slug: `checkout-cat-${Date.now()}` } });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        store_id: storeId,
        category_id: categoryId,
        name: 'Тестовий товар для чекауту',
        price: 500,
        stock_qty: 10,
      }
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { product_id: productId } });
    if (createdOrderId) {
      await prisma.orderAddress.deleteMany({ where: { order_id: createdOrderId } }); // <--- ДОДАНО WHERE
      await prisma.order.delete({ where: { id: createdOrderId } });
    }
    
    await prisma.product.deleteMany({ where: { store_id: storeId } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    
    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Порожній кошик при оформленні → 400', async () => {
    // Новий агент (з порожньою сесією)
    const freshAgent = request.agent(app);
    const res = await freshAgent.post('/api/orders').send({
      guest_name: 'Іван',
      guest_email: 'ivan@test.com',
      guest_phone: '+380991234567',
      delivery_method: 'NovaPoshta',
      payment_method: 'LiqPay',
      address: { city: 'Київ', street: 'Хрещатик 1' }
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Кошик порожній');
  });

  it('Валідація Zod: некоректний email/телефон → 422', async () => {
    // 1. Спочатку додаємо товар у кошик основному агенту
    await agent.post('/api/cart').send({ productId, quantity: 1 });

    // 2. Відправляємо некоректні дані
    const res = await agent.post('/api/orders').send({
      guest_name: 'І', // Занадто коротке
      guest_email: 'invalid-email', // Неправильний формат
      guest_phone: '0991234567', // Немає +380
      delivery_method: 'NovaPoshta',
      payment_method: 'LiqPay',
      address: { city: 'К', street: '1' }
    });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
    // Має бути як мінімум 3 помилки (ім'я, email, телефон)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3); 
  });

  it('E2E Checkpoint: кошик → checkout → підтвердження → очищення кошика', async () => {
    // "Шпигуємо" за console.log, щоб перевірити виклик E-mail mock
    const consoleSpy = vi.spyOn(console, 'log');

    // Відправляємо ВАЛІДНІ дані (товар вже в кошику з попереднього тесту)
    const res = await agent.post('/api/orders').send({
      guest_name: 'Олена',
      guest_email: 'olena@test.com',
      guest_phone: '+380501234567',
      delivery_method: 'NovaPoshta',
      payment_method: 'LiqPay',
      address: { city: 'Львів', street: 'Франка 20', zip_code: '79000' }
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Замовлення успішно оформлено');
    expect(res.body.orders.length).toBe(1);

    createdOrderId = res.body.orders[0].id;

    // Перевіряємо, чи спрацював E-mail mock
    const emailLogFound = consoleSpy.mock.calls.some(call => 
      call[0] && call[0].includes('[SendGrid Mock]') && call[0].includes('olena@test.com')
    );
    expect(emailLogFound).toBe(true);
    
    // Знімаємо "шпигуна"
    consoleSpy.mockRestore();

    // Перевіряємо Checkpoint: кошик має бути порожнім
    const cartRes = await agent.get('/api/cart');
    expect(cartRes.body.items.length).toBe(0);

    // Перевіряємо, що товар списався зі складу (було 10, стало 9)
    const updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(updatedProduct?.stock_qty).toBe(9);
  });

  it('/track/:number — успішне відстеження існуючого замовлення', async () => {
    const res = await agent.get(`/api/orders/track/${createdOrderId}`);
    
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdOrderId);
    expect(res.body.status).toBe('NEW');
    
    // Конфіденційні дані не повинні повертатися
    expect(res.body).not.toHaveProperty('guest_email');
    expect(res.body).not.toHaveProperty('guest_phone');
  });

  it('/track/:number — неіснуючий номер → 404', async () => {
    const fakeId = '33333333-3333-3333-3333-333333333333';
    const res = await agent.get(`/api/orders/track/${fakeId}`);
    
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Замовлення не знайдено');
  });
});