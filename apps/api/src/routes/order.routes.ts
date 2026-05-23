import { Router } from 'express';
import { createOrder, trackOrder } from '../controllers/order.controller';
import { sessionMiddleware } from '../middlewares/session.middleware';

const router = Router();

// Застосовуємо sessionMiddleware ТІЛЬКИ для створення замовлення (щоб знати кошик)
router.post('/', sessionMiddleware, createOrder);

// Відстеження замовлення доступне будь-кому, хто знає унікальний UUID замовлення
router.get('/track/:id', trackOrder);

export default router;