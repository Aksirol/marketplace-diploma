import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../lib/cloudinary';
import { createStore, getMyStore, updateMyStore } from '../controllers/store.controller';

const router = Router();

// Усі маршрути кабінету виробника вимагають авторизації
router.use(authGuard);

// Маршрут подачі заявки: приймає один файл з назвою 'document'
router.post('/', uploadMiddleware.single('document'), createStore);

// Маршрути керування власним профілем магазину
router.get('/me', getMyStore);

// Маршрут оновлення профілю: підтримує завантаження одразу двох окремих файлів
router.put(
  '/me',
  uploadMiddleware.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]),
  updateMyStore
);

export default router;