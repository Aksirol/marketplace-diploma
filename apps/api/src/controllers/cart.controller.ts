import { Request, Response } from 'express';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();
const CART_TTL = 86400; // 24 години в секундах

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

    // Збагачуємо кошик даними з бази (назви, ціни, фото)
    const enrichedItems = await Promise.all(
      cart.items.map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { images: { where: { is_primary: true } } },
        });
        return { ...item, product };
      })
    );

    // Відфільтровуємо товари, які могли бути видалені з БД
    const validItems = enrichedItems.filter(item => item.product);

    res.status(200).json({ items: validItems });
  } catch (error) {
    res.status(500).json({ message: 'Помилка отримання кошика' });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    const { productId, quantity = 1 } = req.body;

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
    const { productId, quantity } = req.body;

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