import { Router } from 'express';
import { getProducts, getProductById } from '../controllers/catalog.controller';
import { getCategories } from '../controllers/category.controller'; // <-- Відновлено імпорт

const router = Router();

// Публічні маршрути каталогу
router.get('/categories', getCategories); // <-- Відновлено маршрут
router.get('/products', getProducts);
router.get('/products/:id', getProductById);

export default router;