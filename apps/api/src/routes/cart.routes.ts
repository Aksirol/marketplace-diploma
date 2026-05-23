import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart } from '../controllers/cart.controller';
import { sessionMiddleware } from '../middlewares/session.middleware';

const router = Router();

// Застосовуємо middleware для всіх маршрутів кошика
router.use(sessionMiddleware);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/', updateCartItem);
router.delete('/:productId', removeFromCart);

export default router;