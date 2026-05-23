import { Request, Response } from 'express';
import { PrismaClient, StoreStatus, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const getStoreById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const store = await prisma.store.findUnique({
      where: { id: id as string, status: StoreStatus.ACTIVE },
      include: {
        products: {
          where: { status: ProductStatus.ACTIVE },
          include: { images: { where: { is_primary: true } } },
        },
      },
    });

    if (!store) {
      res.status(404).json({ message: 'Магазин не знайдено' });
      return;
    }

    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні магазину' });
  }
};