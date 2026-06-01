import { Request, Response } from 'express';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import { uploadToCloudinary } from '../lib/cloudinary';

const prisma = new PrismaClient();

const createProductSchema = z.object({
  name: z.string().min(3, "Назва занадто коротка"),
  description: z.string().optional(),
  price: z.preprocess((val) => Number(val), z.number().positive("Ціна має бути більше 0")),
  stock_qty: z.preprocess((val) => Number(val), z.number().int().min(0, "Кількість не може бути від'ємною")),
  category_id: z.string().uuid("Невірний ID категорії"),
});

const updateProductSchema = createProductSchema.partial();

export const getMyProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    if (!store) {
      res.status(404).json({ message: 'Магазин не знайдено' });
      return;
    }

    // Використовуємо жорсткі рядки для статусів
    const products = await prisma.product.findMany({
      where: {
        store_id: store.id,
        status: { in: [ProductStatus.ACTIVE, ProductStatus.DRAFT] }
      },
      include: {
        category: { select: { name: true } },
        images: true,
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json(products);
  } catch (error) {
    console.error('[Product Controller Error]:', error);
    res.status(500).json({ message: 'Помилка при отриманні списку товарів' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const validatedData = createProductSchema.parse(req.body);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    if (!store) {
      res.status(404).json({ message: 'Спершу створіть магазин' });
      return;
    }

    const initialStatus = store.status === 'ACTIVE' ? ('ACTIVE' as ProductStatus) : ('DRAFT' as ProductStatus);

    const newProduct = await prisma.product.create({
      data: {
        store_id: store.id,
        ...validatedData,
        status: initialStatus
      }
    });

    res.status(201).json({
      message: initialStatus === 'ACTIVE' ? 'Товар успішно створено' : 'Товар створено як чернетку (магазин очікує модерації)',
      product: newProduct
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при створенні товару' });
    }
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.params.id);
    const validatedData = updateProductSchema.parse(req.body);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!store || !product || product.store_id !== store.id) {
      res.status(404).json({ message: 'Товар не знайдено або доступ заборонено' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: validatedData
    });

    res.status(200).json({ message: 'Товар оновлено', product: updatedProduct });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Помилка при оновленні товару' });
    }
  }
};

export const archiveProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.params.id);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!store || !product || product.store_id !== store.id) {
      res.status(404).json({ message: 'Товар не знайдено або доступ заборонено' });
      return;
    }

    await prisma.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' as ProductStatus }
    });

    res.status(200).json({ message: 'Товар успішно переміщено в архів' });
  } catch (error) {
    console.error('[Archive Product Error]:', error);
    res.status(500).json({ message: 'Помилка при архівуванні товару' });
  }
};

export const uploadProductImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.params.id);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });

    if (!store || !product || product.store_id !== store.id) {
      res.status(404).json({ message: 'Товар не знайдено або доступ заборонено' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: 'Не вибрано файлів для завантаження' });
      return;
    }

    if (product.images.length + files.length > 5) {
      res.status(400).json({ message: `Перевищено ліміт. Можна додати ще максимум ${5 - product.images.length} фото.` });
      return;
    }

    const uploadedImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = await uploadToCloudinary(file.buffer, 'products');

      const isPrimary = (product.images.length === 0 && i === 0);

      const newImg = await prisma.productImage.create({
        data: {
          product_id: productId,
          url: imageUrl,
          is_primary: isPrimary,
          sort_order: product.images.length + i
        }
      });
      uploadedImages.push(newImg);
    }

    res.status(201).json({ message: 'Фото успішно завантажено', images: uploadedImages });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при завантаженні фотографій' });
  }
};

export const deleteProductImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const productId = String(req.params.id);
    const imageId = String(req.params.imageId);

    const store = await prisma.store.findUnique({ where: { user_id: userId } });
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!store || !product || product.store_id !== store.id) {
      res.status(404).json({ message: 'Товар не знайдено або доступ заборонено' });
      return;
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.product_id !== productId) {
      res.status(404).json({ message: 'Зображення не знайдено' });
      return;
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const remainingImages = await prisma.productImage.findMany({ where: { product_id: productId }, take: 1 });
      if (remainingImages.length > 0) {
        await prisma.productImage.update({
          where: { id: remainingImages[0].id },
          data: { is_primary: true }
        });
      }
    }

    res.status(200).json({ message: 'Зображення видалено' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при видаленні зображення' });
  }
};