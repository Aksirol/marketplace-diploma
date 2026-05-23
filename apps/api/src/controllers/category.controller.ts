import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    // Отримуємо всі категорії
    const categories = await prisma.category.findMany();

    // Рекурсивна функція для побудови дерева
    const buildTree = (parentId: string | null = null): any[] => {
      return categories
        .filter((cat) => cat.parent_id === parentId)
        .map((cat) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    const categoryTree = buildTree(null);
    res.status(200).json(categoryTree);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні категорій' });
  }
};