import dotenv from 'dotenv';
import path from 'path';

// Завантажуємо .env перед будь-яким тестом
// В CI можна підмінити на .env.test з тестовою БД
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
