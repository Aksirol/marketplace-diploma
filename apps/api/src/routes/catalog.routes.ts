import { Router } from 'express';
import { getCategories } from '../controllers/category.controller';
import { getProducts, getProductById } from '../controllers/product.controller';
import { getStoreById } from '../controllers/store.controller';

const router = Router();

// Категорії
router.get('/categories', getCategories);

// Товари
router.get('/products', getProducts);
router.get('/products/:id', getProductById);

// Магазини
router.get('/stores/:id', getStoreById);

export default router;