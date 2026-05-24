import { Request, Response } from 'express';
import { PrismaClient, OrderStatus, PaymentStatus, Order } from '@prisma/client';
import { z } from 'zod';
import { redisClient } from '../lib/redis';
import jwt from 'jsonwebtoken';
import { getCartId } from './cart.controller';

const prisma = new PrismaClient();

// 1. Zod-схема для валідації форми чекауту (Виправлено Deprecation Warning)
const checkoutSchema = z.object({
  guest_name: z.string().min(2, { message: "Ім'я занадто коротке" }),
  guest_email: z.string().email({ message: "Невірний формат e-mail" }),
  guest_phone: z.string().regex(/^\+380\d{9}$/, { message: "Формат телефону має бути +380XXXXXXXXX" }),
  delivery_method: z.string().min(1, { message: "Оберіть спосіб доставки" }),
  payment_method: z.string().min(1, { message: "Оберіть спосіб оплати" }),
  address: z.object({
    city: z.string().min(2, { message: "Вкажіть місто" }),
    street: z.string().min(5, { message: "Вкажіть вулицю або номер відділення" }),
    zip_code: z.string().min(5, { message: "Вкажіть індекс" }).optional().or(z.literal('')),
  })
});

// Допоміжна функція для отримання кошика
const getRedisCart = async (sessionId: string) => {
  const data = await redisClient.get(`cart:${sessionId}`);
  return data ? JSON.parse(data) : { items: [] };
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    // Витягуємо userId з токена, якщо користувач авторизований
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secret') as any;
        if (decoded && decoded.id) userId = decoded.id;
      } catch (e) {}
    } else if ((req as any).user) {
      userId = (req as any).user.id;
    }

    const cartId = getCartId(req); // <-- Використовуємо універсальний хелпер замість sessionId
    const validatedData = checkoutSchema.parse(req.body);

    const cart = await getRedisCart(cartId);
    if (!cart.items || cart.items.length === 0) {
      res.status(400).json({ message: 'Кошик порожній' });
      return;
    }

    // 4. Отримуємо актуальні дані про товари з БД (щоб дізнатись ціну і магазин)
    const productIds = cart.items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    // 5. Групуємо товари по магазинах (store_id)
    const ordersByStore: Record<string, any[]> = {};
    for (const item of cart.items) {
      const dbProduct = dbProducts.find(p => p.id === item.productId);
      if (!dbProduct) continue;

      if (!ordersByStore[dbProduct.store_id]) {
        ordersByStore[dbProduct.store_id] = [];
      }

      ordersByStore[dbProduct.store_id].push({
        product_id: dbProduct.id,
        quantity: item.quantity,
        unit_price: dbProduct.price,
        stock_qty: dbProduct.stock_qty
      });
    }

    const createdOrders: Order[] = [];

    // 6. Використовуємо Prisma Transaction, щоб гарантувати цілісність даних
    await prisma.$transaction(async (tx) => {
      for (const [storeId, items] of Object.entries(ordersByStore)) {
        // Рахуємо загальну суму для конкретного магазину
        const totalAmount = items.reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0);

        // Перевіряємо залишки
        for (const item of items) {
          if (item.quantity > item.stock_qty) {
            throw new Error(`Недостатньо товару на складі для ID: ${item.product_id}`);
          }
        }

        // Створюємо замовлення
        const newOrder = await tx.order.create({
          data: {
            buyer_id: userId, // <--- ТЕПЕР ЗАМОВЛЕННЯ ПРИВ'ЯЗАНО ДО ЮЗЕРА
            store_id: storeId,
            guest_name: validatedData.guest_name,
            guest_email: validatedData.guest_email,
            guest_phone: validatedData.guest_phone,
            delivery_method: validatedData.delivery_method, // Mock (напр. 'NovaPoshta')
            payment_method: validatedData.payment_method,   // Mock (напр. 'LiqPay')
            total_amount: totalAmount,
            status: OrderStatus.NEW,
            payment_status: PaymentStatus.PENDING,

            // Зв'язки
            items: {
              create: items.map(i => ({
                product: { connect: { id: i.product_id } }, // Явно з'єднуємо з існуючим товаром
                quantity: i.quantity,
                unit_price: i.unit_price
              }))
            },
            address: {
              create: {
                city: validatedData.address.city,
                street: validatedData.address.street,
                zip_code: validatedData.address.zip_code || '00000'
              }
            }
          }
        });

        // Віднімаємо кількість зі складу виробника
        for (const item of items) {
          await tx.product.update({
            where: { id: item.product_id },
            data: { stock_qty: { decrement: item.quantity } }
          });
        }

        createdOrders.push(newOrder);

        // 7. Mock відправки E-mail (SendGrid)
        console.log(`[SendGrid Mock] Відправлено e-mail на ${validatedData.guest_email}. Номер замовлення: ${newOrder.id}`);
      }
    });

    // 8. Очищуємо кошик після успішного оформлення
    await redisClient.del(`cart:${cartId}`);

    res.status(201).json({
      message: 'Замовлення успішно оформлено',
      orders: createdOrders
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
      return;
    } else {
      console.error(error);
      res.status(400).json({ message: error.message || 'Помилка при оформленні замовлення' });
    }
  }
};

export const trackOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id); // Використовуємо ID замовлення як трекінг-номер

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: { select: { name: true, images: { where: { is_primary: true } } } } }
        },
        address: true,
        store: { select: { name: true, location: true } }
      }
    });

    if (!order) {
      res.status(404).json({ message: 'Замовлення не знайдено' });
      return;
    }

    // Ми не повертаємо конфіденційні дані (email/телефон) у цьому відкритому ендпоінті
    res.status(200).json({
      id: order.id,
      status: order.status,
      payment_status: order.payment_status,
      total_amount: order.total_amount,
      tracking_number: order.tracking_number, // Номер накладної НП (буде пустим спочатку)
      delivery_method: order.delivery_method,
      store: order.store,
      items: order.items,
    });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні статусу замовлення' });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String((req as any).user.id);
    const id = String(req.params.id);

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      res.status(404).json({ message: 'Замовлення не знайдено' });
      return;
    }

    // Безпека: перевіряємо, чи належить замовлення цьому юзеру
    if (order.buyer_id !== userId) {
      res.status(403).json({ message: 'Доступ заборонено. Це не ваше замовлення.' });
      return;
    }

    // Скасувати можна тільки нові замовлення або ті, що в обробці
    if (order.status !== 'NEW' && order.status !== 'PROCESSING') {
      res.status(400).json({ message: `Неможливо скасувати замовлення зі статусом ${order.status}` });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELED' }
    });

    res.status(200).json({ message: 'Замовлення успішно скасовано', order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Помилка при скасуванні замовлення' });
  }
};