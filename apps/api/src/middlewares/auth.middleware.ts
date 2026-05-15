import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

// Розширюємо стандартний Request, щоб додати туди дані нашого користувача
export interface AuthRequest extends Request {
  user?: { id: string; role: Role };
}

// 1. authGuard — перевіряє, чи є у користувача валідний Access токен
export const authGuard = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Немає доступу. Токен відсутній.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_ACCESS_SECRET || 'secret';
    // Розшифровуємо токен
    const decoded = jwt.verify(token, secret) as { id: string; role: Role };
    
    // Додаємо дані користувача в об'єкт запиту
    req.user = decoded;
    next(); // Пропускаємо далі
  } catch (error) {
    res.status(401).json({ message: 'Токен недійсний або його термін дії закінчився.' });
  }
};

// 2. roleGuard — перевіряє, чи має користувач потрібну роль
export const roleGuard = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Немає доступу.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'У вас немає прав для виконання цієї дії.' });
      return;
    }

    next(); // Пропускаємо далі
  };
};