import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// 1. Конфігурація Cloudinary з екологічних змінних
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Налаштовуємо Multer для збереження файлу в оперативній пам'яті (Memory Storage)
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Максимум 10 МБ (щоб контролер міг сам відловити 5 МБ і видати гарну помилку)
  },
  fileFilter: (req, file, cb) => {
    // Дозволяємо картинки та PDF
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимий формат файлу. Дозволені: JPG, PNG, PDF.'));
    }
  },
});

// 3. Функція-хелпер для завантаження буфера файлу прямо в Cloudinary через Stream
export const uploadToCloudinary = (fileBuffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        if (result) return resolve(result.secure_url);
        reject(new Error('Помилка завантаження в Cloudinary'));
      }
    );

    // Записуємо буфер у потік і закриваємо його
    uploadStream.end(fileBuffer);
  });
};