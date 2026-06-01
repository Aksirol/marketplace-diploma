import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, StoreStatus, ProductStatus } from '@prisma/client';
import { app } from '../app';
import jwt from 'jsonwebtoken';
import * as cloudinaryModule from '../lib/cloudinary';

const prisma = new PrismaClient();

vi.spyOn(cloudinaryModule, 'uploadToCloudinary').mockResolvedValue('https://fake-cloud.com/product-img.jpg');

describe('Seller Products CRUD (Phase 4.2)', () => {
  let userAToken: string, userBToken: string;
  let userAId: string, userBId: string;
  let storeAId: string, storeBId: string;
  let categoryId: string;
  let productA_Id: string;

  beforeAll(async () => {
    const userA = await prisma.user.create({ data: { email: `prod-a-${Date.now()}@test.com`, password_hash: 'hash', role: Role.PRODUCER } });
    userAId = userA.id;
    userAToken = jwt.sign({ id: userAId, role: Role.PRODUCER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    const userB = await prisma.user.create({ data: { email: `prod-b-${Date.now()}@test.com`, password_hash: 'hash', role: Role.PRODUCER } });
    userBId = userB.id;
    userBToken = jwt.sign({ id: userBId, role: Role.PRODUCER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    const storeA = await prisma.store.create({ data: { user_id: userAId, name: 'Active Store', status: StoreStatus.ACTIVE } });
    storeAId = storeA.id;

    const storeB = await prisma.store.create({ data: { user_id: userBId, name: 'Pending Store', status: StoreStatus.PENDING } });
    storeBId = storeB.id;

    const category = await prisma.category.create({ data: { name: 'Dairy', slug: `dairy-${Date.now()}` } });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Спочатку збираємо ID продуктів, потім чистимо images по product_id
    const productIds = await prisma.product.findMany({
      where: { store_id: { in: [storeAId, storeBId] } },
      select: { id: true }
    }).then(ps => ps.map(p => p.id));

    await prisma.productImage.deleteMany({ where: { product_id: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.store.deleteMany({ where: { id: { in: [storeAId, storeBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  it('Валідація: Ціна <= 0 або stock_qty від\'ємний → 422', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Milk', price: -50, stock_qty: -10, category_id: categoryId });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Помилка валідації');
  });

  it('Магазин PENDING: товар зберігається як DRAFT (не видно в каталозі)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ name: 'Honey', price: 150, stock_qty: 20, category_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe(ProductStatus.DRAFT);
  });

  it('Checkpoint: Товар додано → з\'являється зі статусом ACTIVE (Магазин ACTIVE)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Cheese', price: 200, stock_qty: 5, category_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe(ProductStatus.ACTIVE);
    productA_Id = res.body.product.id;
  });

  it('Ізоляція даних: CRUD лише для свого магазину → чужий :id → 404', async () => {
    const res = await request(app)
      .put(`/api/products/${productA_Id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ price: 999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('не знайдено або доступ заборонено');
  });

  it('Бізнес-логіка: Шосте фото → 400 (max 5 images)', async () => {
    const fakeImg = Buffer.from('fake-image-data');

    const res1 = await request(app)
      .post(`/api/products/${productA_Id}/images`)
      .set('Authorization', `Bearer ${userAToken}`)
      .attach('images', fakeImg, '1.jpg')
      .attach('images', fakeImg, '2.jpg')
      .attach('images', fakeImg, '3.jpg');

    expect(res1.status).toBe(201);
    expect(res1.body.images.length).toBe(3);

    const res2 = await request(app)
      .post(`/api/products/${productA_Id}/images`)
      .set('Authorization', `Bearer ${userAToken}`)
      .attach('images', fakeImg, '4.jpg')
      .attach('images', fakeImg, '5.jpg')
      .attach('images', fakeImg, '6.jpg');

    expect(res2.status).toBe(400);
    expect(res2.body.message).toContain('Перевищено ліміт');
  });

  it('Архівування: Товар зі статусом ARCHIVED не повертається GET /products', async () => {
    const archiveRes = await request(app)
      .patch(`/api/products/${productA_Id}/archive`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(archiveRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(0);
  });
});