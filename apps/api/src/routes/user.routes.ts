import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../lib/cloudinary';
import {
  getProfile, updateProfile, changePassword,
  getAddresses, createAddress, updateAddress, deleteAddress
} from '../controllers/user.controller';

const router = Router();

// Усі маршрути кабінету вимагають обов'язкової JWT авторизації
router.use(authGuard);

// Профіль та безпека
router.get('/me', getProfile);
router.put('/me', uploadMiddleware.single('avatar'), updateProfile); // Обробка файлу 'avatar'
router.put('/me/password', changePassword);

// Керування адресами (CRUD)
router.get('/me/addresses', getAddresses);
router.post('/me/addresses', createAddress);
router.put('/me/addresses/:id', updateAddress);
router.delete('/me/addresses/:id', deleteAddress);

export default router;