import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { uploadToCloudinary } from '../lib/cloudinary';

const prisma = new PrismaClient();

// Схеми валідації через Zod
const updateProfileSchema = z.object({
  first_name: z.string().min(2, "Ім'я занадто коротке").optional(),
  last_name: z.string().min(2, "Прізвище занадто коротке").optional(),
  phone: z.string().regex(/^\+380\d{9}$/, "Формат телефону: +380XXXXXXXXX").optional().or(z.literal('')),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Введіть старий пароль"),
  newPassword: z.string().min(6, "Новий пароль має бути не менше 6 символів"),
});

const addressSchema = z.object({
  title: z.string().min(2, "Назва (напр. Дім, Робота) обов'язкова"),
  city: z.string().min(2, "Вкажіть місто"),
  street: z.string().min(3, "Вкажіть вулицю та будинок"),
  zip_code: z.string().min(5, "Некоректний поштовий індекс"),
});

// --- ПРОФІЛЬ ---

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

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
    const userId = (req as any).user.id;
    const validatedData = updateProfileSchema.parse(req.body);

    let avatarUrl = undefined;

    // Якщо користувач завантажив новий файл аватара
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;

    // Зверни увагу: у твоїй схемі модель адрес може називатись userAddresses або подібним чином,
    // адаптуємо під реляційну модель Prisma для збережених адрес користувача
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
    const { id } = req.params;
    const validatedData = addressSchema.parse(req.body);

    // Перевіряємо, чи належить адреса користувачу перед оновленням
    const address = await prisma.userAddress.findFirst({
      where: { id: id as string, user_id: userId }
    });

    if (!address) {
      res.status(404).json({ message: 'Адресу не знайдено або доступ заборонено' });
      return;
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id: id as string },
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
    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await prisma.userAddress.findFirst({
      where: { id: id as string, user_id: userId }
    });

    if (!address) {
      res.status(404).json({ message: 'Адресу не знайдено або доступ заборонено' });
      return;
    }

    await prisma.userAddress.delete({
      where: { id: id as string }
    });

    res.status(200).json({ message: 'Адресу успішно видалено' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при видаленні адреси' });
  }
};