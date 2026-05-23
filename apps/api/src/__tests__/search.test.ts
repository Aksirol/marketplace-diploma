import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, StoreStatus } from '@prisma/client';
import { app } from '../app';
import { redisClient } from '../lib/redis'; // Наш Redis клієнт

const prisma = new PrismaClient();

describe('Search & Filtering Flow', () => {
  let honeyCategoryId: string;
  let cheeseCategoryId: string;
  let storeFrankivskId: string;
  let storeLvivId: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Підключаємо Redis
    if (!redisClient.isOpen) await redisClient.connect();

    // 1. Створюємо категорії з унікальними slug (додаємо Date.now)
    const honeyCat = await prisma.category.create({ data: { name: 'Мед', slug: `honey-${Date.now()}` } });
    honeyCategoryId = honeyCat.id;
    const cheeseCat = await prisma.category.create({ data: { name: 'Сир', slug: `cheese-${Date.now()}` } });
    cheeseCategoryId = cheeseCat.id;

    // 2. Створюємо користувачів-виробників
    const user1 = await prisma.user.create({ data: { email: `prod1-${Date.now()}@test.com`, role: Role.PRODUCER } });
    user1Id = user1.id;
    
    const user2 = await prisma.user.create({ data: { email: `prod2-${Date.now()}@test.com`, role: Role.PRODUCER } });
    user2Id = user2.id;

    // 3. Створюємо магазини
    const storeIF = await prisma.store.create({
      data: { user_id: user1.id, name: 'Карпатський мед', location: 'Івано-Франківськ', status: StoreStatus.ACTIVE }
    });
    storeFrankivskId = storeIF.id;

    const storeLV = await prisma.store.create({
      data: { user_id: user2.id, name: 'Львівська сироварня', location: 'Львів', status: StoreStatus.ACTIVE }
    });
    storeLvivId = storeLV.id;

    // 4. Створюємо товари
    await prisma.product.create({
      data: { store_id: storeFrankivskId, category_id: honeyCategoryId, name: 'Гречаний мед', price: 220 }
    });
    await prisma.product.create({
      data: { store_id: storeFrankivskId, category_id: honeyCategoryId, name: 'Липовий мед', price: 250 }
    });
    await prisma.product.create({
      data: { store_id: storeLvivId, category_id: cheeseCategoryId, name: 'Козячий сир', price: 150 }
    });
  });

  afterAll(async () => {
    // Очищуємо ТІЛЬКИ свої дані, щоб не зламати інші паралельні тести
    await prisma.product.deleteMany({ where: { store_id: { in: [storeFrankivskId, storeLvivId] } } });
    await prisma.store.deleteMany({ where: { id: { in: [storeFrankivskId, storeLvivId] } } });
    await prisma.category.deleteMany({ where: { id: { in: [honeyCategoryId, cheeseCategoryId] } } });
    // Тут ми видаляємо користувачів не за email (бо ми додали Date.now), а за їх зв'язками, 
    // але найпростіше просто залишити їх в базі для тестів, або видалити так:
    await prisma.user.deleteMany({ where: { id: { in: [user1Id, user2Id] } } });
    
    // Закриваємо з'єднання
    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Пошук: "мед" знаходить "Гречаний мед" та "Липовий мед"', async () => {
    // Використовуємо encodeURIComponent для передачі кирилиці в URL
    const res = await request(app).get(`/api/products?q=${encodeURIComponent('мед')}`);
    
    expect(res.status).toBe(200);
    // Має знайти обидва меди
    expect(res.body.products.length).toBeGreaterThanOrEqual(2);
    
    const names = res.body.products.map((p: any) => p.name);
    expect(names).toContain('Гречаний мед');
    expect(names).toContain('Липовий мед');
    expect(names).not.toContain('Козячий сир');
  });

  it('Фільтр окремо: категорія (повертає лише сир)', async () => {
    const res = await request(app).get(`/api/products?category=${cheeseCategoryId}`);
    
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].name).toBe('Козячий сир');
  });

  it('Фільтр окремо: location (повертає товари з Івано-Франківська)', async () => {
    const res = await request(app).get(`/api/products?location=${encodeURIComponent('Івано-Франківськ')}`);
    
    expect(res.status).toBe(200);
    // Має знайти два меди з цього магазину
    expect(res.body.products.length).toBe(2);
    expect(res.body.products[0].store.location).toBe('Івано-Франківськ');
  });

  it('Комбінація фільтрів: category + price + location', async () => {
    // Шукаємо мед з Франківська, ціна якого не більше 230 (має знайти лише Гречаний мед - 220 грн)
    const url = `/api/products?category=${honeyCategoryId}&location=${encodeURIComponent('Івано-Франківськ')}&max_price=230`;
    const res = await request(app).get(url);
    
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].name).toBe('Гречаний мед');
    expect(Number(res.body.products[0].price)).toBeLessThanOrEqual(230);
  });

  it('Redis: повторний запит повертається з кешу', async () => {
    const url = `/api/products?q=${encodeURIComponent('сир')}`;
    
    // Перший запит (йде в БД, записується в Redis)
    const res1 = await request(app).get(url);
    expect(res1.body.fromCache).toBe(false);

    // Другий запит (має повернутися з Redis)
    const res2 = await request(app).get(url);
    expect(res2.body.fromCache).toBe(true);
  });
});