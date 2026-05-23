import { Request, Response } from 'express';
import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cursor, limit = '10' } = req.query;
    const take = parseInt(limit as string, 10);

    const products = await prisma.product.findMany({
      take,
      ...(cursor && {
        skip: 1, // Пропускаємо сам курсор
        cursor: { id: cursor as string },
      }),
      where: { status: ProductStatus.ACTIVE }, // Показуємо лише активні товари
      include: {
        images: { where: { is_primary: true } }, // Беремо лише головне фото
        store: { select: { name: true, location: true } },
        category: { select: { name: true, slug: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const nextCursor = products.length === take ? products[take - 1].id : null;

    res.status(200).json({ products, nextCursor });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні товарів' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: id as string },
      include: {
        images: { orderBy: { sort_order: 'asc' } },
        store: { select: { id: true, name: true, logo_url: true, location: true } },
        category: true,
      },
    });

    if (!product) {
      res.status(404).json({ message: 'Товар не знайдено' });
      return;
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні товару' });
  }
};