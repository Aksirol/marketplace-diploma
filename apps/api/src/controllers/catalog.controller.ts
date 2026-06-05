import { Request, Response } from 'express';
import { PrismaClient, ProductStatus, Prisma } from '@prisma/client';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q, min_price, max_price, category, location,
      sort = 'newest', limit = '10', cursor
    } = req.query;

    const take = parseInt(limit as string, 10);

    // ВИПРАВЛЕНО: Додали limit_${take} до ключа кешу
    const cacheKey = `search:${q || 'all'}:c_${category || 'all'}:l_${location || 'all'}:p_${min_price}-${max_price}:s_${sort}:limit_${take}`;

    if (!cursor || cursor === 'null') {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        res.status(200).json({ ...JSON.parse(cachedData), fromCache: true });
        return;
      }
    }

    const whereClause: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (q) {
      whereClause.name = { search: (q as string).split(' ').join(' & ') };
    }
    if (category) whereClause.category_id = category as string;
    if (min_price || max_price) {
      whereClause.price = {
        ...(min_price && { gte: parseFloat(min_price as string) }),
        ...(max_price && { lte: parseFloat(max_price as string) }),
      };
    }
    if (location) {
      whereClause.store = { location: { contains: location as string, mode: 'insensitive' } };
    }

    let orderByClause: Prisma.ProductOrderByWithRelationInput = { created_at: 'desc' };
    if (sort === 'price_asc') orderByClause = { price: 'asc' };
    if (sort === 'price_desc') orderByClause = { price: 'desc' };
    if (sort === 'rating') orderByClause = { average_rating: 'desc' };

    const products = await prisma.product.findMany({
      take,
      // ВИПРАВЛЕНО: Захист від рядка "null" з клієнта
      ...(cursor && cursor !== 'null' && { skip: 1, cursor: { id: cursor as string } }),
      where: whereClause,
      orderBy: orderByClause,
      include: {
        images: { where: { is_primary: true } },
        store: { select: { name: true, location: true } },
        category: { select: { name: true, slug: true } },
      },
    });

    const nextCursor = products.length === take ? products[take - 1].id : null;
    const responseData = { products, nextCursor };

    if (!cursor || cursor === 'null') {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
    }

    res.status(200).json({ ...responseData, fromCache: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Помилка при отриманні товарів' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: id as string, status: ProductStatus.ACTIVE },
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