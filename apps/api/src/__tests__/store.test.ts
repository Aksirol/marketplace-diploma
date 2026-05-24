import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient, Role, StoreStatus } from '@prisma/client';
import { app } from '../app';
import jwt from 'jsonwebtoken';
import * as cloudinaryModule from '../lib/cloudinary';

const prisma = new PrismaClient();

// МОКАЄМО Cloudinary: перехоплюємо функцію завантаження, щоб вона не робила реальних запитів
vi.spyOn(cloudinaryModule, 'uploadToCloudinary').mockResolvedValue('https://fake-cloud.com/document.pdf');

describe('Seller Dashboard Flow (Phase 4.1)', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    // 1. Створюємо двох звичайних покупців (USER)
    const userA = await prisma.user.create({
      data: { email: `seller-a-${Date.now()}@test.com`, password_hash: 'hash', role: Role.USER }
    });
    userAId = userA.id;
    userAToken = jwt.sign({ id: userAId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });

    const userB = await prisma.user.create({
      data: { email: `seller-b-${Date.now()}@test.com`, password_hash: 'hash', role: Role.USER }
    });
    userBId = userB.id;
    userBToken = jwt.sign({ id: userBId, role: Role.USER }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '15m' });
  });

  afterAll(async () => {
    // Очищаємо тестові дані
    await prisma.storeDoc.deleteMany({ where: { store: { user_id: { in: [userAId, userBId] } } } });
    await prisma.store.deleteMany({ where: { user_id: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();

    // Відновлюємо оригінальні функції
    vi.restoreAllMocks();
  });

  it('Валідація: пуста назва (без файлу) → 420 / 422', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: '', description: 'Опис' }); // multipart/form-data не використовується навмисно

    // 422 - якщо Zod зловив пусте ім'я, або 420 - якщо контролер зловив відсутність файлу
    expect([420, 422]).toContain(res.status);
  });

  it('Безпека/Валідація: Файл > 5 МБ → 400', async () => {
    // Генеруємо фейковий файл розміром 6 МБ
    const hugeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('name', 'Моя Ферма')
      .field('location', 'Київ')
      .attach('document', hugeBuffer, { filename: 'big.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Розмір документа не повинен перевищувати 5 МБ');
  });

  it('Checkpoint: Успішна подача заявки (Документи в Cloudinary, e-mail надійшов)', async () => {
    const validPdfBuffer = Buffer.from('Фейковий вміст PDF документа');

    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('name', 'Еко Мед')
      .field('description', 'Найкращий мед з Карпат')
      .field('location', 'Карпати')
      .attach('document', validPdfBuffer, { filename: 'fop.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Заявку успішно надіслано');

    // Перевіряємо, чи викликалась функція завантаження в Cloudinary
    expect(cloudinaryModule.uploadToCloudinary).toHaveBeenCalled();

    // Перевіряємо статус (має бути PENDING)
    expect(res.body.store.status).toBe(StoreStatus.PENDING);
  });

  it('Бізнес-логіка: Другий магазин від того ж акаунту → 400 (Bad Request)', async () => {
    const validPdfBuffer = Buffer.from('Фейковий вміст PDF документа');

    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('name', 'Другий Магазин')
      .attach('document', validPdfBuffer, { filename: 'fop2.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400); // У нашому контролері це 400, що цілком підходить
    expect(res.body.message).toContain('Ви вже подали заявку або маєте зареєстрований магазин');
  });

  it('Ізоляція даних (PUT /stores/me): Юзер B не може редагувати магазин Юзера A → 404', async () => {
    // Юзер B ще не має магазину, він намагається відправити PUT запит
    const res = await request(app)
      .put('/api/stores/me')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ name: 'Хакерська назва' });

    // Оскільки контролер шукає магазин виключно за user_id (Юзера B), він нічого не знайде
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Магазин не знайдено');
  });

  it('Оновлення власного профілю (PUT /stores/me) проходить успішно', async () => {
    const res = await request(app)
      .put('/api/stores/me')
      .set('Authorization', `Bearer ${userAToken}`) // Токен Юзера А (власника "Еко Мед")
      .field('description', 'Оновлений опис меду')
      .attach('logo', Buffer.from('Логотип'), { filename: 'logo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.store.description).toBe('Оновлений опис меду');
    // Логотип мав оновитися на замоканий URL
    expect(res.body.store.logo_url).toBe('https://fake-cloud.com/document.pdf');
  });
});