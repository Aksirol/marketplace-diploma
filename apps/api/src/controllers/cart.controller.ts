import { Request, Response } from 'express';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { redisClient } from '../lib/redis';
import { z } from 'zod';

const prisma = new PrismaClient();
const CART_TTL = 86400; // 24 години в секундах

const cartItemSchema = z.object({
  productId: z.string().uuid('Некоректний ID товару'),
  quantity: z.number().int().positive('Кількість має бути більшою за 0')
});

// Допоміжна функція для отримання кошика з Redis
const getRedisCart = async (sessionId: string) => {
  const data = await redisClient.get(`cart:${sessionId}`);
  return data ? JSON.parse(data) : { items: [] };
};

// Допоміжна функція для збереження кошика в Redis з оновленням TTL
const saveRedisCart = async (sessionId: string, cart: any) => {
  await redisClient.setEx(`cart:${sessionId}`, CART_TTL, JSON.stringify(cart));
};

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    const cart = await getRedisCart(sessionId);

    if (!cart.items || cart.items.length === 0) {
      res.status(200).json({ items: [] });
      return;
    }

    // 1 запит замість циклу (виправляємо N+1)
    const productIds = cart.items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { images: { where: { is_primary: true } } },
    });

    const validItems = cart.items.map((item: any) => ({
      ...item,
      product: dbProducts.find((p) => p.id === item.productId)
    })).filter((item: any) => item.product); // Відфільтровуємо видалені

    res.status(200).json({ items: validItems });
  } catch (error) {
    res.status(500).json({ message: 'Помилка отримання кошика' });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    const { productId, quantity } = cartItemSchema.parse(req.body);

    // 1. Перевіряємо наявність товару в БД
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      res.status(404).json({ message: 'Товар не знайдено або недоступний' });
      return;
    }

    // 2. Отримуємо поточний кошик
    const cart = await getRedisCart(sessionId);
    const existingItem = cart.items.find((i: any) => i.productId === productId);
    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    // 3. Перевіряємо залишки (stock_qty)
    if (newQuantity > product.stock_qty) {
      res.status(400).json({ message: `Доступно лише ${product.stock_qty} одиниць` });
      return;
    }

    // 4. Оновлюємо кошик
    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ productId, quantity: newQuantity });
    }

    await saveRedisCart(sessionId, cart);
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка додавання до кошика' });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    const { productId, quantity } = cartItemSchema.parse(req.body);

    if (quantity < 1) {
      res.status(400).json({ message: 'Кількість має бути більше 0' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || quantity > product.stock_qty) {
      res.status(400).json({ message: `Доступно лише ${product?.stock_qty || 0} одиниць` });
      return;
    }

    const cart = await getRedisCart(sessionId);
    const itemIndex = cart.items.findIndex((i: any) => i.productId === productId);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await saveRedisCart(sessionId, cart);
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення кошика' });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    const { productId } = req.params;

    const cart = await getRedisCart(sessionId);
    
    // Перевіряємо, чи є такий товар у кошику
    const itemExists = cart.items.some((i: any) => i.productId === productId);
    if (!itemExists) {
      res.status(404).json({ message: 'Товар не знайдено в кошику' });
      return;
    }

    // Видаляємо товар
    cart.items = cart.items.filter((i: any) => i.productId !== productId);

    await saveRedisCart(sessionId, cart);
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка видалення з кошика' });
  }
};