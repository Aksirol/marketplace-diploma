import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import { createOrder, trackOrder, cancelOrder } from '../controllers/order.controller';
import { sessionMiddleware } from '../middlewares/session.middleware';

const router = Router();

// Застосовуємо sessionMiddleware ТІЛЬКИ для створення замовлення (щоб знати кошик)
router.post('/', sessionMiddleware, createOrder);
router.post('/:id/cancel', authGuard, cancelOrder);

// Відстеження замовлення доступне будь-кому, хто знає унікальний UUID замовлення
router.get('/track/:id', trackOrder);

export default router;