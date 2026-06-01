import { Router } from 'express';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../lib/cloudinary';
import {
  getMyProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  uploadProductImages,
  deleteProductImage
} from '../controllers/product.controller';
import { Role } from '@prisma/client';

const router = Router();

router.use(authGuard);

router.get('/',           authGuard, roleGuard([Role.PRODUCER]), getMyProducts);    // ← без цього рядка — провалюється в каталог
router.post('/',          authGuard, roleGuard([Role.PRODUCER]), createProduct);
router.put('/:id',        authGuard, roleGuard([Role.PRODUCER]), updateProduct);
router.patch('/:id/archive', authGuard, roleGuard([Role.PRODUCER]), archiveProduct);
router.post('/:id/images',   authGuard, roleGuard([Role.PRODUCER]),
  uploadMiddleware.array('images', 5), uploadProductImages);
router.delete('/:id/images/:imageId', authGuard, roleGuard([Role.PRODUCER]), deleteProductImage);

export default router;