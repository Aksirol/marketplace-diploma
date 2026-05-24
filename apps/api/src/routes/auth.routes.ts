import { Router } from 'express';
import {
  register, login, refresh, logout,
  verifyEmail, forgotPassword, resetPassword
} from '../controllers/auth.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout); // <--- Додано логаут

router.get('/verify/:token', verifyEmail); // <--- Додано верифікацію
router.post('/forgot-password', forgotPassword); // <--- Додано запит скидання
router.post('/reset-password', resetPassword); // <--- Додано зміну пароля

// Тестові маршрути залишаються
router.get('/me', authGuard, (req, res) => {
  res.json({ message: 'Це захищені дані', user: (req as any).user });
});

router.get('/producer-only', authGuard, roleGuard([Role.PRODUCER]), (req, res) => {
  res.json({ message: 'Доступ дозволено! Ви виробник.' });
});

export default router;