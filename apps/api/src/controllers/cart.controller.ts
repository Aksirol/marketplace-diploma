import { Request, Response } from 'express';
import { redisClient } from '../lib/redis';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Хелпер для визначення ID кошика
export const getCartId = (req: Request): string => {
  // 1. Спочатку перевіряємо токен напряму (бо роути кошика публічні)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secret') as any;
      if (decoded && decoded.id) {
        return decoded.id; // Це ID авторизованого юзера
      }
    } catch (error) {
      // Якщо токен недійсний, просто ігноруємо і йдемо далі
    }
  }

  // 2. Якщо є req.user (на випадок, якщо десь використано authGuard)
  const user = (req as any).user;
  if (user) return user.id;

  // 3. Фолбек для гостя (ID сесії з middleware або cookies)
  return (req as any).sessionId || req.cookies?.session_id;
};

// Хелпер для злиття кошиків
export const mergeCarts = async (sessionId: string, userId: string): Promise<void> => {
  const guestCartData = await redisClient.get(`cart:${sessionId}`);
  if (!guestCartData) return; // Якщо гостьовий кошик порожній, нічого не робимо

  const guestCart = JSON.parse(guestCartData);
  if (!guestCart.items || guestCart.items.length === 0) return;

  const userCartData = await redisClient.get(`cart:${userId}`);
  const userCart = userCartData ? JSON.parse(userCartData) : { items: [] };

  // Зливаємо товари
  guestCart.items.forEach((guestItem: any) => {
    const existingItem = userCart.items.find((i: any) => i.productId === guestItem.productId);
    if (existingItem) {
      // Якщо товар вже є в кошику юзера, СУМУЄМО кількість
      existingItem.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  });

  // Зберігаємо об'єднаний кошик для користувача (на 7 днів)
  await redisClient.setEx(`cart:${userId}`, 7 * 24 * 60 * 60, JSON.stringify(userCart));
  // Видаляємо гостьовий кошик
  await redisClient.del(`cart:${sessionId}`);
};

const CART_TTL = 86400; // 24 години в секундах

const cartItemSchema = z.object({
  productId: z.string().uuid('Некоректний ID товару'),
  quantity: z.number().int().positive('Кількість має бути більшою за 0')
});

// Допоміжна функція для отримання кошика з Redis
const getRedisCart = async (cartId: string) => {
  const data = await redisClient.get(`cart:${cartId}`);
  return data ? JSON.parse(data) : { items: [] };
};

// Допоміжна функція для збереження кошика в Redis
const saveRedisCart = async (cartId: string, cart: any) => {
  await redisClient.setEx(`cart:${cartId}`, CART_TTL, JSON.stringify(cart));
};

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cartId = getCartId(req); // <--- ВИПРАВЛЕНО ТУТ
    const cart = await getRedisCart(cartId);

    if (!cart.items || cart.items.length === 0) {
      res.status(200).json({ items: [] });
      return;
    }

    const productIds = cart.items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { images: { where: { is_primary: true } } },
    });

    const validItems = cart.items.map((item: any) => ({
      ...item,
      product: dbProducts.find((p) => p.id === item.productId)
    })).filter((item: any) => item.product);

    res.status(200).json({ items: validItems });
  } catch (error) {
    res.status(500).json({ message: 'Помилка отримання кошика' });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cartId = getCartId(req);
    const { productId, quantity } = cartItemSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      res.status(404).json({ message: 'Товар не знайдено або недоступний' });
      return;
    }

    const cart = await getRedisCart(cartId);
    const existingItem = cart.items.find((i: any) => i.productId === productId);
    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (newQuantity > product.stock_qty) {
      res.status(400).json({ message: `Доступно лише ${product.stock_qty} одиниць` });
      return;
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ productId, quantity: newQuantity });
    }

    await saveRedisCart(cartId, cart);
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка додавання до кошика' });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const cartId = getCartId(req);
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

    const cart = await getRedisCart(cartId);
    const itemIndex = cart.items.findIndex((i: any) => i.productId === productId);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await saveRedisCart(cartId, cart);
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення кошика' });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cartId = getCartId(req);
    const { productId } = req.params;

    const cart = await getRedisCart(cartId);

    const itemExists = cart.items.some((i: any) => i.productId === productId);
    if (!itemExists) {
      res.status(404).json({ message: 'Товар не знайдено в кошику' });
      return;
    }

    cart.items = cart.items.filter((i: any) => i.productId !== productId);

    await saveRedisCart(cartId, cart);
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Помилка видалення з кошика' });
  }
};