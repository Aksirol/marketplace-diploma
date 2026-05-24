import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { redisClient } from '../lib/redis';
import { mergeCarts } from '../controllers/cart.controller';

describe('Unit Test: mergeCarts (Cart Merge Logic)', () => {
  beforeAll(async () => {
    // Підключаємо Redis для тестів
    if (!redisClient.isOpen) await redisClient.connect();
  });

  // Очищаємо Redis ПЕРЕД КОЖНИМ тестом, щоб вони були на 100% ізольованими
  beforeEach(async () => {
    await redisClient.flushAll();
  });

  afterAll(async () => {
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Case 1: Порожній гостьовий кошик (не існує) → кошик юзера не змінюється', async () => {
    // Юзер вже мав кошик
    await redisClient.set('cart:user1', JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }] }));

    // Запускаємо функцію злиття з неіснуючим гостьовим ID
    await mergeCarts('guest1', 'user1');

    const userCartData = await redisClient.get('cart:user1');
    const userCart = JSON.parse(userCartData || '{}');

    expect(userCart.items).toHaveLength(1);
    expect(userCart.items[0].quantity).toBe(2);
  });

  it('Case 2: Порожній акаунт (немає кошика) → гостьовий кошик переноситься повністю', async () => {
    // Гість набрав товарів
    await redisClient.set('cart:guest2', JSON.stringify({ items: [{ productId: 'p2', quantity: 3 }] }));

    // Запускаємо злиття для юзера, який ще нічого не купував
    await mergeCarts('guest2', 'user2');

    const userCartData = await redisClient.get('cart:user2');
    const userCart = JSON.parse(userCartData || '{}');

    // Перевіряємо, що товари перенеслися
    expect(userCart.items).toHaveLength(1);
    expect(userCart.items[0].productId).toBe('p2');
    expect(userCart.items[0].quantity).toBe(3);

    // Перевіряємо, що гостьовий кошик знищено, щоб не засмічувати пам'ять
    const guestCartData = await redisClient.get('cart:guest2');
    expect(guestCartData).toBeNull();
  });

  it('Case 3: Абсолютно різні товари → об\'єднуються в один масив', async () => {
    await redisClient.set('cart:guest3', JSON.stringify({ items: [{ productId: 'p_apple', quantity: 1 }] }));
    await redisClient.set('cart:user3', JSON.stringify({ items: [{ productId: 'p_banana', quantity: 2 }] }));

    await mergeCarts('guest3', 'user3');

    const userCartData = await redisClient.get('cart:user3');
    const userCart = JSON.parse(userCartData || '{}');

    expect(userCart.items).toHaveLength(2);

    // Знаходимо товари незалежно від їхнього порядку в масиві
    const apple = userCart.items.find((i: any) => i.productId === 'p_apple');
    const banana = userCart.items.find((i: any) => i.productId === 'p_banana');

    expect(apple.quantity).toBe(1);
    expect(banana.quantity).toBe(2);
  });

  it('Case 4: Однакові товари в обох кошиках (КОНФЛІКТ) → кількість СУМУЄТЬСЯ', async () => {
    // Гість додав 2 ноутбуки, і раніше з акаунту він додав 3 такі ж ноутбуки
    await redisClient.set('cart:guest4', JSON.stringify({ items: [{ productId: 'p_laptop', quantity: 2 }] }));
    await redisClient.set('cart:user4', JSON.stringify({ items: [{ productId: 'p_laptop', quantity: 3 }] }));

    await mergeCarts('guest4', 'user4');

    const userCartData = await redisClient.get('cart:user4');
    const userCart = JSON.parse(userCartData || '{}');

    // Товар має залишитись один, але кількість має стати 5
    expect(userCart.items).toHaveLength(1);
    expect(userCart.items[0].productId).toBe('p_laptop');
    expect(userCart.items[0].quantity).toBe(5); // 2 + 3 = 5
  });

  it('Case 5: Гостьовий кошик існує, але масив items порожній [] → ігнорується', async () => {
    await redisClient.set('cart:guest5', JSON.stringify({ items: [] }));
    await redisClient.set('cart:user5', JSON.stringify({ items: [{ productId: 'p_mango', quantity: 1 }] }));

    await mergeCarts('guest5', 'user5');

    const userCartData = await redisClient.get('cart:user5');
    const userCart = JSON.parse(userCartData || '{}');

    expect(userCart.items).toHaveLength(1);
    expect(userCart.items[0].productId).toBe('p_mango');
  });
});