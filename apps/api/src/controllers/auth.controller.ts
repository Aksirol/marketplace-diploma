import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient, Role } from '@prisma/client';
import { redisClient } from '../lib/redis';
import { mergeCarts } from './cart.controller';
import { z } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email('Некоректний формат email'),
  password: z.string().min(8, 'Пароль має бути не менше 8 символів'),
  first_name: z.string().min(2, "Ім'я занадто коротке").optional(),
  last_name: z.string().min(2, 'Прізвище занадто коротке').optional(),
  role: z.enum(['USER', 'PRODUCER']).default('USER'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Токен обов\'язковий'),
  newPassword: z.string().min(8, 'Новий пароль має бути не менше 8 символів'),
});

const generateTokens = (userId: string, role: Role) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'secret';

  const accessToken = jwt.sign({ id: userId, role }, accessSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId, role }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: validatedData.email } });
    if (existingUser) {
      res.status(409).json({ message: 'Користувач з таким email вже існує' });
      return;
    }

    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    const assignedRole = validatedData.role === 'PRODUCER' ? Role.PRODUCER : Role.USER;

    const newUser = await prisma.user.create({
      data: {
        email: validatedData.email,
        password_hash: passwordHash,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        role: assignedRole,
        is_active: false,
      },
    });

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await redisClient.setEx(`verify:${verifyToken}`, 24 * 60 * 60, newUser.id);

    console.log(`[Email Mock] Підтвердження email для ${validatedData.email}: http://localhost:3000/verify/${verifyToken}`);

    res.status(201).json({
      message: 'Реєстрація успішна. Перевірте email для підтвердження акаунту.',
      role: newUser.role
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка сервера під час реєстрації' });
    }
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const userId = await redisClient.get(`verify:${token}`);
    if (!userId) {
      res.status(400).json({ message: 'Недійсний або прострочений токен підтвердження' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { is_active: true }
    });

    await redisClient.del(`verify:${token}`);

    res.status(200).json({ message: 'Email успішно підтверджено. Тепер ви можете увійти.' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при підтвердженні email' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).json({ message: 'Невірний email або пароль' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ message: 'Акаунт не підтверджено. Перевірте email.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Невірний email або пароль' });
      return;
    }

    const tokens = generateTokens(user.id, user.role);

    const sessionId = (req as any).sessionId || req.cookies?.session_id;
    if (sessionId) {
      await mergeCarts(sessionId, user.id);
    }

    res.status(200).json({ message: 'Вхід успішний', tokens, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера під час входу' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token відсутній' });
      return;
    }

    const isBlacklisted = await redisClient.get(`bl:${refreshToken}`);
    if (isBlacklisted) {
      res.status(401).json({ message: 'Цей токен було анульовано. Будь ласка, увійдіть знову.' });
      return;
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'secret';
    const decoded = jwt.verify(refreshToken, refreshSecret) as { id: string; role: Role };

    const tokens = generateTokens(decoded.id, decoded.role);
    res.status(200).json({ tokens });
  } catch (error) {
    res.status(403).json({ message: 'Недійсний refresh token' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: 'Токен відсутній' });
      return;
    }

    const decoded = jwt.decode(refreshToken) as any;
    if (decoded && decoded.exp) {
      const expiresInSeconds = decoded.exp - Math.floor(Date.now() / 1000);

      if (expiresInSeconds > 0) {
        await redisClient.setEx(`bl:${refreshToken}`, expiresInSeconds, 'revoked');
      }
    }

    res.status(200).json({ message: 'Ви успішно вийшли з системи' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при виході' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await redisClient.setEx(`reset:${resetToken}`, 15 * 60, user.id);

      console.log(`[Email Mock] Відновлення паролю для ${email}: http://localhost:3000/reset-password?token=${resetToken}`);
    }

    res.status(200).json({ message: 'Якщо цей email зареєстровано, ми надіслали інструкції з відновлення.' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при запиті на відновлення' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const userId = await redisClient.get(`reset:${token}`);
    if (!userId) {
      res.status(400).json({ message: 'Недійсний або прострочений токен відновлення' });
      return;
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash }
    });

    await redisClient.del(`reset:${token}`);

    res.status(200).json({ message: 'Пароль успішно змінено. Тепер ви можете увійти.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при скиданні пароля' });
    }
  }
};