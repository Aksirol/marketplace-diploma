import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const sessionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Шукаємо session_id в cookies
  let sessionId = req.cookies?.session_id;

  // Якщо немає — генеруємо новий і встановлюємо cookie
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie('session_id', sessionId, {
      httpOnly: true, // Захист від XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 години в мілісекундах
      sameSite: 'lax', // Дозволяє відправляти cookie між фронтом і беком на localhost
    });
  }

  // Зберігаємо sessionId в об'єкті запиту для контролера
  (req as any).sessionId = sessionId;
  next();
};