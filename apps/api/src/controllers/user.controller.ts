import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { uploadToCloudinary } from '../lib/cloudinary';

const prisma = new PrismaClient();

// Схеми валідації через Zod (Виправлено Deprecation Warning: використано { message: "..." })
const updateProfileSchema = z.object({
  first_name: z.string().min(2, { message: "Ім'я занадто коротке" }).optional(),
  last_name: z.string().min(2, { message: "Прізвище занадто коротке" }).optional(),
  phone: z.string().regex(/^\+380\d{9}$/, { message: "Формат телефону: +380XXXXXXXXX" }).optional().or(z.literal('')),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, { message: "Введіть старий пароль" }),
  newPassword: z.string().min(6, { message: "Новий пароль має бути не менше 6 символів" }),
});

const addressSchema = z.object({
  title: z.string().min(2, { message: "Назва (напр. Дім, Робота) обов'язкова" }),
  city: z.string().min(2, { message: "Вкажіть місто" }),
  street: z.string().min(3, { message: "Вкажіть вулицю та будинок" }),
  zip_code: z.string().min(5, { message: "Некоректний поштовий індекс" }),
});

// --- ПРОФІЛЬ ---

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, first_name: true, last_name: true, phone: true, avatar_url: true, role: true }
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні профілю' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = updateProfileSchema.parse(req.body);

    let avatarUrl = undefined;

    if (req.file) {
      avatarUrl = await uploadToCloudinary(req.file.buffer, 'avatars');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...validatedData,
        ...(avatarUrl && { avatar_url: avatarUrl }),
      },
      select: { id: true, email: true, first_name: true, last_name: true, phone: true, avatar_url: true }
    });

    res.status(200).json({ message: 'Профіль успішно оновлено', user: updatedUser });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації даних', errors: error.issues });
    } else {
      res.status(500).json({ message: error.message || 'Помилка при оновленні профілю' });
    }
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password_hash) {
      res.status(404).json({ message: 'Користувача не знайдено' });
      return;
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ message: 'Поточний пароль вказано невірно' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash }
    });

    res.status(200).json({ message: 'Пароль успішно змінено' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при зміні пароля' });
    }
  }
};

// --- ЗБЕРЕЖЕНІ АДРЕСИ (CRUD) ---

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);

    const addresses = await prisma.userAddress.findMany({
      where: { user_id: userId }
    });

    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні адрес' });
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = addressSchema.parse(req.body);

    const newAddress = await prisma.userAddress.create({
      data: {
        user_id: userId,
        title: validatedData.title,
        city: validatedData.city,
        street: validatedData.street,
        zip_code: validatedData.zip_code,
      }
    });

    res.status(201).json(newAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при створенні адреси' });
    }
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const id = String(req.params.id);
    const validatedData = addressSchema.parse(req.body);

    const address = await prisma.userAddress.findFirst({
      where: { id, user_id: userId }
    });

    if (!address) {
      res.status(404).json({ message: 'Адресу не знайдено або доступ заборонено' });
      return;
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id },
      data: validatedData,
    });

    res.status(200).json(updatedAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при оновленні адреси' });
    }
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const id = String(req.params.id);

    const address = await prisma.userAddress.findFirst({
      where: { id, user_id: userId }
    });

    if (!address) {
      res.status(404).json({ message: 'Адресу не знайдено або доступ заборонено' });
      return;
    }

    await prisma.userAddress.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Адресу успішно видалено' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при видаленні адреси' });
  }
};

// --- ІСТОРІЯ ЗАМОВЛЕНЬ ---

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    // Виправляємо проблему з string | string[]
    const status = req.query.status as string | undefined;

    const whereClause: any = { buyer_id: userId };

    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        store: { select: { id: true, name: true, logo_url: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, images: { where: { is_primary: true } } } }
          }
        }
      }
    });

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні історії замовлень' });
  }
};

// --- СПИСОК БАЖАНЬ (WISHLIST) ---

export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);

    const wishlist = await prisma.wishlist.findMany({
      where: { user_id: userId },
      include: {
        product: {
          include: {
            images: { where: { is_primary: true } },
            store: { select: { name: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні списку бажань' });
  }
};

export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.body.productId);

    if (!req.body.productId) {
      res.status(400).json({ message: 'productId обов\'язковий' });
      return;
    }

    const existing = await prisma.wishlist.findFirst({
      where: { user_id: userId, product_id: productId }
    });

    if (existing) {
      res.status(400).json({ message: 'Товар вже є у списку бажань' });
      return;
    }

    const item = await prisma.wishlist.create({
      data: { user_id: userId, product_id: productId }
    });

    res.status(201).json({ message: 'Товар додано до списку бажань', item });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при додаванні до списку бажань' });
  }
};

export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.params.productId); // Виправляємо проблему типізації Prisma

    await prisma.wishlist.deleteMany({
      where: { user_id: userId, product_id: productId }
    });

    res.status(200).json({ message: 'Товар видалено зі списку бажань' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при видаленні' });
  }
};