import { Request, Response } from 'express';
import { PrismaClient, OrderStatus, PaymentStatus, Order } from '@prisma/client';
import { z } from 'zod';
import { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

// 1. Zod-схема для валідації форми чекауту
const checkoutSchema = z.object({
  guest_name: z.string().min(2, "Ім'я занадто коротке"),
  guest_email: z.string().email("Невірний формат e-mail"),
  guest_phone: z.string().regex(/^\+380\d{9}$/, "Формат телефону має бути +380XXXXXXXXX"),
  delivery_method: z.string().min(1, "Оберіть спосіб доставки"),
  payment_method: z.string().min(1, "Оберіть спосіб оплати"),
  address: z.object({
    city: z.string().min(2, "Вкажіть місто"),
    street: z.string().min(5, "Вкажіть вулицю або номер відділення"),
    zip_code: z.string().min(5, "Вкажіть індекс").optional().or(z.literal('')),
  })
});

// Допоміжна функція для отримання кошика
const getRedisCart = async (sessionId: string) => {
  const data = await redisClient.get(`cart:${sessionId}`);
  return data ? JSON.parse(data) : { items: [] };
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = (req as any).sessionId;
    
    // 2. Валідація вхідних даних через Zod
    const validatedData = checkoutSchema.parse(req.body);

    // 3. Отримуємо кошик
    const cart = await getRedisCart(sessionId);
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
    await redisClient.del(`cart:${sessionId}`);

    res.status(201).json({ 
      message: 'Замовлення успішно оформлено', 
      orders: createdOrders 
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ message: 'Помилка валідації', errors: error.issues });
      return; // <--- ДОДАНО RETURN
    } else {
      console.error(error);
      res.status(400).json({ message: error.message || 'Помилка при оформленні замовлення' });
    }
  }
};

export const trackOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Використовуємо ID замовлення як трекінг-номер

    const order = await prisma.order.findUnique({
      where: { id: id as string },
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