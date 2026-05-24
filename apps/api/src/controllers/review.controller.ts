import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const reviewSchema = z.object({
  order_id: z.string().uuid({ message: "Некоректний ID замовлення" }),
  product_id: z.string().uuid({ message: "Некоректний ID товару" }),
  rating: z.number().int().min(1).max(5, { message: "Рейтинг має бути від 1 до 5" }),
  comment: z.string().max(500, { message: "Коментар занадто довгий (максимум 500 символів)" }).optional(),
});

export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = reviewSchema.parse(req.body);

    // 1. Знаходимо замовлення з його товарами
    const order = await prisma.order.findUnique({
      where: { id: validatedData.order_id },
      include: { items: true }
    });

    if (!order) {
      res.status(404).json({ message: 'Замовлення не знайдено' });
      return;
    }

    // 2. Перевіряємо, чи належить замовлення цьому юзеру
    if (order.buyer_id !== userId) {
      res.status(403).json({ message: 'Доступ заборонено. Це не ваше замовлення.' });
      return;
    }

    // 3. Перевіряємо статус замовлення (відгук тільки після доставки)
    if (order.status !== 'DELIVERED') {
      res.status(400).json({ message: 'Відгук можна залишити лише після отримання (доставки) товару' });
      return;
    }

    // 4. Перевіряємо, чи є цей товар у вказаному замовленні
    const hasProduct = order.items.some(item => item.product_id === validatedData.product_id);
    if (!hasProduct) {
      res.status(400).json({ message: 'Цей товар відсутній у вказаному замовленні' });
      return;
    }

    // 5. Захист від спаму: 1 відгук на 1 товар у межах 1 замовлення
    const existingReview = await prisma.review.findFirst({
      where: {
        user_id: userId,
        order_id: validatedData.order_id,
        product_id: validatedData.product_id
      }
    });

    if (existingReview) {
      res.status(400).json({ message: 'Ви вже залишили відгук на цей товар у цьому замовленні' });
      return;
    }

    // 6. Prisma Transaction: Створюємо відгук та одразу перераховуємо рейтинг товару
    await prisma.$transaction(async (tx) => {
      // Додаємо новий відгук
      await tx.review.create({
        data: {
          user_id: userId,
          order_id: validatedData.order_id,
          product_id: validatedData.product_id,
          rating: validatedData.rating,
          comment: validatedData.comment
        }
      });

      // Рахуємо середнє значення рейтингу для цього товару
      const aggregations = await tx.review.aggregate({
        _avg: { rating: true },
        where: { product_id: validatedData.product_id }
      });

      const newAvgRating = aggregations._avg.rating || 0;

      // Оновлюємо кешоване значення рейтингу в моделі Product
      await tx.product.update({
        where: { id: validatedData.product_id },
        data: { average_rating: newAvgRating }
      });
    });

    res.status(201).json({ message: 'Відгук успішно додано' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      console.error(error);
      res.status(500).json({ message: 'Помилка при створенні відгуку' });
    }
  }
};