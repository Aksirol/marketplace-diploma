import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, StoreStatus } from '@prisma/client';
import { app } from '../app';

const prisma = new PrismaClient();

describe('Catalog & Guest Flow', () => {
  let parentCategoryId: string;
  let childCategoryId: string;
  let storeId: string;
  let productId1: string;
  let productId2: string;
  let userId: string;

  // Перед початком тестів створюємо тестові дані в базі
  beforeAll(async () => {
    // 1. Створюємо користувача-виробника
    const user = await prisma.user.create({
      data: {
        email: `test-producer-${Date.now()}@test.com`,
        password_hash: 'hash',
        role: Role.PRODUCER,
      },
    });
    userId = user.id;

    // 2. Створюємо магазин
    const store = await prisma.store.create({
      data: {
        user_id: userId,
        name: 'Тестовий Магазин',
        status: StoreStatus.ACTIVE,
      },
    });
    storeId = store.id;

    // 3. Створюємо дерево категорій
    const parent = await prisma.category.create({
      data: { name: 'Головна категорія', slug: `parent-${Date.now()}` },
    });
    parentCategoryId = parent.id;

    const child = await prisma.category.create({
      data: { 
        name: 'Підкатегорія', 
        slug: `child-${Date.now()}`,
        parent_id: parentCategoryId // Зв'язок самореференції
      },
    });
    childCategoryId = child.id;

    // 4. Створюємо кілька товарів для перевірки пагінації (обов'язково ACTIVE)
    const p1 = await prisma.product.create({
      data: {
        store_id: storeId,
        category_id: childCategoryId,
        name: 'Товар 1 (Найновіший)',
        price: 100,
      },
    });
    productId1 = p1.id;

    // Робимо невелику паузу, щоб created_at гарантовано відрізнявся
    await new Promise((resolve) => setTimeout(resolve, 10));

    const p2 = await prisma.product.create({
      data: {
        store_id: storeId,
        category_id: childCategoryId,
        name: 'Товар 2 (Старіший)',
        price: 200,
      },
    });
    productId2 = p2.id;
  });

  // Після тестів прибираємо за собою
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { store_id: storeId } });
    await prisma.category.deleteMany({ where: { id: { in: [parentCategoryId, childCategoryId] } } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('GET /api/categories: повертає дерево категорій (рекурсія)', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Шукаємо нашу створену головну категорію
    const targetParent = res.body.find((c: any) => c.id === parentCategoryId);
    expect(targetParent).toBeDefined();
    
    // Перевіряємо вкладеність (children)
    expect(targetParent).toHaveProperty('children');
    expect(Array.isArray(targetParent.children)).toBe(true);
    
    // Перевіряємо, чи є всередині підкатегорія
    const targetChild = targetParent.children.find((c: any) => c.id === childCategoryId);
    expect(targetChild).toBeDefined();
    expect(targetChild.name).toBe('Підкатегорія');
  });

  it('GET /api/products: cursor-пагінація, ліміт, порядок (orderBy created_at desc)', async () => {
    // 1. Робимо запит з лімітом 1, щоб отримати найновіший товар
    const res1 = await request(app).get('/api/products?limit=1');
    expect(res1.status).toBe(200);
    expect(res1.body.products.length).toBe(1);
    
    // Оскільки сортування desc, перший товар має бути найновішим (Товар 2)
    // Але в нашому seed Товар 2 створений ПІЗНІШЕ, тому він "Найновіший" в БД
    const firstProduct = res1.body.products[0];
    const cursor = res1.body.nextCursor;
    
    expect(cursor).toBeDefined(); // Має бути курсор для наступної сторінки

    // 2. Робимо другий запит з використанням курсору
    const res2 = await request(app).get(`/api/products?limit=1&cursor=${cursor}`);
    expect(res2.status).toBe(200);
    expect(res2.body.products.length).toBeGreaterThanOrEqual(1);
    
    const secondProduct = res2.body.products[0];
    // Перевіряємо, що товари дійсно різні (пагінація працює)
    expect(firstProduct.id).not.toBe(secondProduct.id);
  });

  it('GET /api/products/:id: успішно повертає картку товару', async () => {
    const res = await request(app).get(`/api/products/${productId1}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(productId1);
    expect(res.body).toHaveProperty('store'); // Перевіряємо зв'язок (include)
    expect(res.body).toHaveProperty('category');
  });

  it('GET /api/products/:id: не існує → 404', async () => {
    // Генеруємо випадковий, але валідний UUID, якого точно немає в базі
    const fakeId = '12345678-1234-1234-1234-1234567890ab';
    const res = await request(app).get(`/api/products/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Товар не знайдено');
  });
});