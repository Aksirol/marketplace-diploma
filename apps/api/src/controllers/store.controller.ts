import { Request, Response } from 'express';
import { PrismaClient, StoreStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { uploadToCloudinary } from '../lib/cloudinary';

const prisma = new PrismaClient();

// Схеми валідації через Zod
const createStoreSchema = z.object({
  name: z.string().min(3, { message: "Назва магазину має бути не менше 3 символів" }),
  description: z.string().max(1000, { message: "Опис занадто довгий" }).optional(),
  location: z.string().min(2, { message: "Вкажіть локацію виробництва" }).optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(3, { message: "Назва магазину занадто коротка" }).optional(),
  description: z.string().max(1000).optional(),
  location: z.string().optional(),
});

// 1. ПОДАЧА ЗАЯВКИ НА СТВОРЕННЯ МАГАЗИНУ
export const createStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = createStoreSchema.parse(req.body);

    // Перевіряємо, чи немає в користувача вже створеного магазину
    const existingStore = await prisma.store.findUnique({ where: { user_id: userId } });
    if (existingStore) {
      res.status(400).json({ message: 'Ви вже подали заявку або маєте зареєстрований магазин' });
      return;
    }

    // Перевіряємо, чи було завантажено документ підтвердження
    if (!req.file) {
      res.status(420).json({ message: 'Для реєстрації необхідно завантажити документ (ID-картка, витяг ФОП тощо)' });
      return;
    }

    // Валідація файлу (дозволяємо PDF та зображення до 5 МБ)
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.status(400).json({ message: 'Дозволені формати документів: PDF, JPEG, PNG' });
      return;
    }

    if (req.file.size > 5 * 1024 * 1024) {
      res.status(400).json({ message: 'Розмір документа не повинен перевищувати 5 МБ' });
      return;
    }

    // Завантажуємо документ у Cloudinary
    const docUrl = await uploadToCloudinary(req.file.buffer, 'store_docs');

    // Створюємо магазин у статусі PENDING за допомогою Prisma Transaction
    const store = await prisma.$transaction(async (tx) => {
      const newStore = await tx.store.create({
        data: {
          user_id: userId,
          name: validatedData.name,
          description: validatedData.description,
          location: validatedData.location,
          status: StoreStatus.PENDING, // За замовчуванням очікує модерації
        }
      });

      // Зберігаємо посилання на документ у реляційній таблиці
      await tx.storeDoc.create({
        data: {
          store_id: newStore.id,
          doc_url: docUrl,
          doc_type: req.file!.mimetype
        }
      });

      // Переводимо користувача на роль PRODUCER
      await tx.user.update({
        where: { id: userId },
        data: { role: Role.PRODUCER }
      });

      return newStore;
    });

    // Отримуємо email користувача для відправки листа
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      console.log(`[SendGrid Mock] Відправлено e-mail на ${user.email}. Тема: «Заявку на реєстрацію магазину ${store.name} отримано. Очікуйте на модерацію адміном протягом 24 годин.»`);
    }

    res.status(201).json({
      message: 'Заявку успішно надіслано. Очікуйте на розгляд адміністратора.',
      store
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації даних', errors: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ message: 'Помилка при створенні профілю магазину' });
    }
  }
};

// 2. ОТРИМАННЯ ПРОФІЛЮ СВОГО МАГАЗИНУ
export const getMyStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);

    const store = await prisma.store.findUnique({
      where: { user_id: userId },
      include: { docs: { select: { id: true, doc_url: true, doc_type: true } } }
    });

    if (!store) {
      res.status(404).json({ message: 'У вас ще немає зареєстрованого магазину' });
      return;
    }

    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера при отриманні профілю магазину' });
  }
};

// 3. РЕДАГУВАННЯ ПРОФІЛЮ МАГАЗИНУ (МЕДІА: ЛОГО + БАНЕР)
export const updateMyStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = updateStoreSchema.parse(req.body);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    if (!store) {
      res.status(404).json({ message: 'Магазин не знайдено' });
      return;
    }

    let logoUrl = undefined;
    let bannerUrl = undefined;

    // Працюємо з Multer Fields (лого та банер завантажуються під різними іменами)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    if (files) {
      if (files['logo']?.[0]) {
        logoUrl = await uploadToCloudinary(files['logo'][0].buffer, 'store_logos');
      }
      if (files['banner']?.[0]) {
        bannerUrl = await uploadToCloudinary(files['banner'][0].buffer, 'store_banners');
      }
    }

    const updatedStore = await prisma.store.update({
      where: { id: store.id },
      data: {
        ...validatedData,
        ...(logoUrl && { logo_url: logoUrl }),
        ...(bannerUrl && { banner_url: bannerUrl }),
      }
    });

    res.status(200).json({ message: 'Профіль магазину успішно оновлено', store: updatedStore });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ message: 'Помилка сервера при оновленні магазину' });
    }
  }
};

// 4. ПУБЛІЧНИЙ ПЕРЕГЛЯД МАГАЗИНУ (Для покупців)
export const getStoreById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // <--- ВИПРАВЛЕНО ТУТ (Явне приведення до типу string)

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        products: {
          where: { status: 'ACTIVE' }, // Показуємо тільки активні товари
          include: {
            images: { where: { is_primary: true } }
          }
        }
      }
    });

    // Публічно видно тільки ACTIVE магазини
    if (!store || store.status !== 'ACTIVE') {
      res.status(404).json({ message: 'Магазин не знайдено або він на модерації' });
      return;
    }

    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера при отриманні магазину' });
  }
};