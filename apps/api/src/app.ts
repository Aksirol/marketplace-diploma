import express, { Request, Response } from 'express';
import authRoutes from './routes/auth.routes';
import catalogRoutes from './routes/catalog.routes';
import cookieParser from 'cookie-parser';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import reviewRoutes from './routes/review.routes';
import storeRoutes from './routes/store.routes';

export const app = express();

app.use(express.json());
app.use(cookieParser());

// Підключаємо маршрути авторизації
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stores', storeRoutes);

// Оновлений Health-check ендпоінт, що повертає версію
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    version: '1.0.0',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});