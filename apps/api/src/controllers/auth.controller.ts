import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// Допоміжна функція для створення токенів
const generateTokens = (userId: string, role: Role) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'secret';

  const accessToken = jwt.sign({ id: userId, role }, accessSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId, role }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, first_name, last_name, role } = req.body;

    // Перевіряємо, чи існує користувач
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: 'Користувач з таким email вже існує' });
      return;
    }

    // Хешуємо пароль (12 раундів — це надійно і достатньо швидко)
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Дозволяємо реєстрацію лише як USER або PRODUCER (адміна так не створити)
    const assignedRole = role === Role.PRODUCER ? Role.PRODUCER : Role.USER;

    // Створюємо користувача в БД
    const newUser = await prisma.user.create({
      data: {
        email,
        password_hash,
        first_name,
        last_name,
        role: assignedRole,
      },
    });

    const tokens = generateTokens(newUser.id, newUser.role);
    res.status(201).json({ message: 'Реєстрація успішна', tokens, role: newUser.role });
  } catch (error) {
    res.status(500).json({ message: 'Помилка сервера під час реєстрації' });
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

    // Перевіряємо, чи збігається пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Невірний email або пароль' });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
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

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'secret';
    
    // Перевіряємо валідність refresh токена
    const decoded = jwt.verify(refreshToken, refreshSecret) as { id: string; role: Role };
    
    // Генеруємо нову пару токенів
    const tokens = generateTokens(decoded.id, decoded.role);
    
    res.status(200).json({ tokens });
  } catch (error) {
    res.status(403).json({ message: 'Недійсний refresh token' });
  }
};