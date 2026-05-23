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
    
    // 1. Формуємо унікальний ключ для Redis на основі параметрів (без курсора)
    // Ми кешуємо тільки першу сторінку популярних пошукових запитів
    const cacheKey = `search:${q || 'all'}:c_${category || 'all'}:l_${location || 'all'}:p_${min_price}-${max_price}:s_${sort}`;

    if (!cursor) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // Якщо дані є в Redis, повертаємо їх миттєво (Cache Hit)
        res.status(200).json({ ...JSON.parse(cachedData), fromCache: true });
        return;
      }
    }

    // 2. Будуємо умови фільтрації (WHERE)
    const whereClause: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    // Повнотекстовий пошук (to_tsvector під капотом Prisma)
    if (q) {
      whereClause.name = { search: (q as string).split(' ').join(' & ') }; 
      // Prisma конвертує пробіли в логічне "І" для tsquery: "мед & липовий"
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

    // 3. Будуємо умови сортування (ORDER BY)
    let orderByClause: Prisma.ProductOrderByWithRelationInput = { created_at: 'desc' }; // newest за замовчуванням
    if (sort === 'price_asc') orderByClause = { price: 'asc' };
    if (sort === 'price_desc') orderByClause = { price: 'desc' };
    if (sort === 'rating') {
      // Сортування за середнім рейтингом з таблиці Reviews
      orderByClause = { reviews: { _count: 'desc' } };
    }

    // 4. Виконуємо запит до БД
    const products = await prisma.product.findMany({
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor as string } }),
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

    // 5. Зберігаємо в Redis (TTL 60 секунд) тільки якщо це перша сторінка
    if (!cursor) {
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