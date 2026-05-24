import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import { createReview } from '../controllers/review.controller';

const router = Router();

// Маршрут створення відгуку (вимагає авторизації)
router.post('/', authGuard, createReview);

export default router;