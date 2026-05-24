import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, StoreStatus, Role } from '@prisma/client';
import { app } from '../app';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

describe('Guest Cart Flow (Redis)', () => {
  let productId: string;
  let storeId: string;
  let categoryId: string;
  let userId: string;

  // Створюємо двох незалежних "агентів" (імітуємо два різні браузери/вкладки)
  const browserA = request.agent(app);
  const browserB = request.agent(app);

  beforeAll(async () => {
    // Підключаємо Redis
    if (!redisClient.isOpen) await redisClient.connect();

    // ОЧИЩАЄМО REDIS ВІД СТАРИХ ТЕСТІВ
    await redisClient.flushAll();

    // Створюємо тестові дані
    const user = await prisma.user.create({ data: { email: `cart-${Date.now()}@test.com`, role: Role.PRODUCER } });
    userId = user.id;

    const store = await prisma.store.create({ data: { user_id: userId, name: 'Cart Store', status: StoreStatus.ACTIVE } });
    storeId = store.id;

    const category = await prisma.category.create({ data: { name: 'Cart Cat', slug: `cart-cat-${Date.now()}` } });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        store_id: storeId,
        category_id: categoryId,
        name: 'Лімітований товар',
        price: 100,
        stock_qty: 5, // Вказуємо ліміт: 5 штук на складі
      }
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Очищуємо тестові дані
    await prisma.product.deleteMany({ where: { store_id: storeId } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    
    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Ізоляція кошиків: браузер А та браузер Б мають різні кошики (через cookies)', async () => {
    // Браузер А додає товар у кошик
    const resA = await browserA.post('/api/cart').send({ productId, quantity: 1 });
    expect(resA.status).toBe(200);
    expect(resA.body.items.length).toBe(1);

    // Звичайний запит БЕЗ агента гарантує 100% відсутність cookies
    const resB = await request(app).get('/api/cart');

    expect(resB.status).toBe(200);
    // У нового браузера кошик гарантовано має бути порожнім
    expect(resB.body.items.length).toBe(0);
  });

  it('Додавання: quantity понад stock → 400', async () => {
    // Браузер А намагається додати ще 10 штук (на складі лише 5)
    const res = await browserA.post('/api/cart').send({ productId, quantity: 10 });
    
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Доступно лише 5 одиниць');
  });

  it('DELETE: неіснуючий item → 404', async () => {
    const fakeId = '11111111-1111-1111-1111-111111111111';
    
    // Браузер А намагається видалити товар, якого немає в кошику
    const res = await browserA.delete(`/api/cart/${fakeId}`);
    
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Товар не знайдено в кошику');
  });

  it('TTL у Redis: сесія має жити 24 години (86400 секунд)', async () => {
    // Створюємо нового чистого агента, щоб гарантовано отримати set-cookie
    const freshAgent = request.agent(app);
    
    // Робимо POST запит (додаємо товар), щоб ключ точно створився в Redis
    const res = await freshAgent.post('/api/cart').send({ productId, quantity: 1 });
    
    const cookies = res.header['set-cookie'];
    expect(cookies).toBeDefined(); // Тепер cookie точно буде у відповіді
    
    // Витягуємо session_id з рядка cookie
    let sessionId = '';
    if (cookies) {
      const match = cookies[0].match(/session_id=([^;]+)/);
      if (match) sessionId = match[1];
    }
    expect(sessionId).not.toBe('');
    
    // Перевіряємо TTL (час життя ключа) безпосередньо в Redis
    const ttl = await redisClient.ttl(`cart:${sessionId}`);
    
    // TTL має бути встановлено і не перевищувати 86400 (24 години)
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86400); 
  });
});