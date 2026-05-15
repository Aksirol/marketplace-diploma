import { PrismaClient, Role, StoreStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Починаємо заповнення бази даних...');

  // 1. Створюємо тестових користувачів
  const admin = await prisma.user.upsert({
    where: { email: 'admin@marketplace.ua' },
    update: {},
    create: {
      email: 'admin@marketplace.ua',
      first_name: 'Super',
      last_name: 'Admin',
      role: Role.ADMIN,
      password_hash: 'hashed_password_mock',
    },
  });

  const producerUser = await prisma.user.upsert({
    where: { email: 'producer@local.ua' },
    update: {},
    create: {
      email: 'producer@local.ua',
      first_name: 'Остап',
      last_name: 'Коваль',
      role: Role.PRODUCER,
      password_hash: 'hashed_password_mock',
    },
  });

  const buyerUser = await prisma.user.upsert({
    where: { email: 'buyer@email.com' },
    update: {},
    create: {
      email: 'buyer@email.com',
      first_name: 'Анна',
      last_name: 'Покупець',
      role: Role.USER,
      password_hash: 'hashed_password_mock',
    },
  });

  // 2. Створюємо магазин для виробника
  const store = await prisma.store.upsert({
    where: { user_id: producerUser.id },
    update: {},
    create: {
      user_id: producerUser.id,
      name: 'Медова Спадщина',
      description: 'Найкращий крафтовий мед з Карпат',
      location: 'Івано-Франківськ',
      status: StoreStatus.ACTIVE,
    },
  });

  // 3. Створюємо категорії
  const foodCategory = await prisma.category.upsert({
    where: { slug: 'food' },
    update: {},
    create: {
      name: 'Їжа та напої',
      slug: 'food',
    },
  });

  const honeyCategory = await prisma.category.upsert({
    where: { slug: 'honey' },
    update: {},
    create: {
      name: 'Мед',
      slug: 'honey',
      parent_id: foodCategory.id, // Демонстрація самореференції
    },
  });

  // 4. Створюємо товари
  await prisma.product.create({
    data: {
      store_id: store.id,
      category_id: honeyCategory.id,
      name: 'Акацієвий мед',
      description: 'Свіжий акацієвий мед, зібраний екологічним шляхом.',
      price: 250.00,
      stock_qty: 50,
    },
  });

  await prisma.product.create({
    data: {
      store_id: store.id,
      category_id: honeyCategory.id,
      name: 'Гречаний мед',
      description: 'Насичений темний мед.',
      price: 220.00,
      stock_qty: 20,
    },
  });

  console.log('Базу даних успішно заповнено!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });