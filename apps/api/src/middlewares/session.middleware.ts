import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto'; // Використовуємо надійний вбудований модуль Node.js

export const sessionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let sessionId = req.cookies?.session_id;

  // Захист: якщо cookie немає АБО вона має помилковий текст 'undefined'
  if (!sessionId || sessionId === 'undefined') {
    sessionId = crypto.randomUUID();
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
  }

  (req as any).sessionId = sessionId;
  next();
};