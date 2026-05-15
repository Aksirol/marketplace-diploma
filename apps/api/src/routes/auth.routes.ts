import { Router } from 'express';
import { register, login, refresh } from '../controllers/auth.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);

// Приклад захищеного маршруту для тестування (можеш спробувати його викликати)
router.get('/me', authGuard, (req, res) => {
  // Цей код виконається ТІЛЬКИ якщо authGuard пропустив запит
  res.json({ message: 'Це захищені дані', user: (req as any).user });
});

// Приклад маршруту ТІЛЬКИ для виробників
router.get('/producer-only', authGuard, roleGuard([Role.PRODUCER]), (req, res) => {
  res.json({ message: 'Доступ дозволено! Ви виробник.' });
});

export default router;