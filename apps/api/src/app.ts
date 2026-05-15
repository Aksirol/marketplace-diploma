import express, { Request, Response } from 'express';
import authRoutes from './routes/auth.routes';

export const app = express();

app.use(express.json());

// Підключаємо маршрути авторизації
app.use('/api/auth', authRoutes);

// Оновлений Health-check ендпоінт, що повертає версію
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    version: '1.0.0',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});