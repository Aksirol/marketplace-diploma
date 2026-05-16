import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== СХЕМИ ВАЛІДАЦІЇ (Zod v4) ====================
// Zod v4: API параметр error замість required_error
// Рядки з апострофом (обов'язковий) — використовуємо подвійні лапки

const RegisterSchema = z.object({
  email: z
    .string({ error: "Email обов'язковий" })
    .email("Невірний формат email")
    .toLowerCase(),
  password: z
    .string({ error: "Пароль обов'язковий" })
    .min(8, "Пароль повинен містити мінімум 8 символів")
    .max(72, "Пароль занадто довгий"),
  first_name: z
    .string()
    .min(2, "Ім'я повинно містити мінімум 2 символи")
    .max(50, "Ім'я занадто довге")
    .optional(),
  last_name: z
    .string()
    .max(50, "Прізвище занадто довге")
    .optional(),
  // Лише USER або PRODUCER — адміна через форму не створити
  role: z.enum([Role.USER, Role.PRODUCER]).default(Role.USER),
});

const LoginSchema = z.object({
  email: z
    .string({ error: "Email обов'язковий" })
    .email("Невірний формат email")
    .toLowerCase(),
  password: z
    .string({ error: "Пароль обов'язковий" })
    .min(1, "Пароль не може бути порожнім"),
});

const RefreshSchema = z.object({
  refreshToken: z
    .string({ error: "Refresh token обов'язковий" })
    .min(1, "Refresh token не може бути порожнім"),
});

// ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

const generateTokens = (userId: string, role: Role) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  // Падаємо голосно — краще помилка при старті, ніж тихий 'secret' у проді
  if (!accessSecret || !refreshSecret) {
    throw new Error("JWT_ACCESS_SECRET та JWT_REFRESH_SECRET мають бути задані в .env");
  }

  const accessToken = jwt.sign({ id: userId, role }, accessSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId, role }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// ==================== КОНТРОЛЕРИ ====================

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        message: "Помилка валідації",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password, first_name, last_name, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: "Користувач з таким email вже існує" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: { email, password_hash, first_name, last_name, role },
    });

    const tokens = generateTokens(newUser.id, newUser.role);
    res.status(201).json({ message: "Реєстрація успішна", tokens, role: newUser.role });
  } catch (error) {
    console.error('[register]', error);
    res.status(500).json({ message: "Помилка сервера під час реєстрації" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        message: "Помилка валідації",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Умисно не розрізняємо "email не знайдено" і "пароль невірний"
    if (!user || !user.password_hash) {
      res.status(401).json({ message: "Невірний email або пароль" });
      return;
    }

    // Перевірка блокування — до bcrypt.compare, щоб не витрачати CPU
    if (!user.is_active) {
      res.status(403).json({ message: "Акаунт заблоковано. Зверніться до служби підтримки." });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Невірний email або пароль" });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
    res.status(200).json({ message: "Вхід успішний", tokens, role: user.role });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ message: "Помилка сервера під час входу" });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(401).json({ message: "Refresh token відсутній або невірний формат" });
      return;
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      throw new Error("JWT_REFRESH_SECRET не задано в .env");
    }

    const decoded = jwt.verify(parsed.data.refreshToken, refreshSecret) as { id: string; role: Role };

    // Перевіряємо актуальний стан — юзер міг бути заблокований після видачі токена
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.is_active) {
      res.status(403).json({ message: "Акаунт не знайдено або заблоковано" });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
    res.status(200).json({ tokens });
  } catch (error) {
    res.status(403).json({ message: "Недійсний або прострочений refresh token" });
  }
};