import express, { Request, Response } from 'express';

export const app = express();

app.use(express.json());

// Оновлений Health-check ендпоінт, що повертає версію
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    version: '1.0.0',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});