import { PrismaClient, Role, StoreStatus, ProductStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Починаємо заповнення бази даних...');

  // Хешуємо паролі заздалегідь — щоб seed-акаунти реально працювали через /auth/login
  const SALT_ROUNDS = 12;
  const adminHash    = await bcrypt.hash('Admin123!', SALT_ROUNDS);
  const producerHash = await bcrypt.hash('Producer123!', SALT_ROUNDS);
  const buyerHash    = await bcrypt.hash('Buyer123!', SALT_ROUNDS);

  // ===================== КОРИСТУВАЧІ =====================

  const admin = await prisma.user.upsert({
    where: { email: 'admin@marketplace.ua' },
    update: {},
    create: {
      email: 'admin@marketplace.ua',
      first_name: 'Супер',
      last_name: 'Адмін',
      role: Role.ADMIN,
      password_hash: adminHash,
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
      password_hash: producerHash,
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
      password_hash: buyerHash,
    },
  });

  console.log('Користувачі створені.');

  // ===================== МАГАЗИН =====================

  const store = await prisma.store.upsert({
    where: { user_id: producerUser.id },
    update: {},
    create: {
      user_id: producerUser.id,
      name: 'Медова Спадщина',
      description: 'Крафтовий мед з Карпат — від пасічника безпосередньо до столу.',
      location: 'Івано-Франківськ',
      status: StoreStatus.ACTIVE,
    },
  });

  console.log('Магазин створений.');

  // ===================== КАТЕГОРІЇ =====================

  // Демонструємо самореференцію: Їжа → Мед
  const foodCategory = await prisma.category.upsert({
    where: { slug: 'food' },
    update: {},
    create: { name: 'Їжа та напої', slug: 'food' },
  });

  const honeyCategory = await prisma.category.upsert({
    where: { slug: 'honey' },
    update: {},
    create: {
      name: 'Мед',
      slug: 'honey',
      parent_id: foodCategory.id, // Підкатегорія — ілюструє parent_id самореференцію
    },
  });

  const craftsCategory = await prisma.category.upsert({
    where: { slug: 'crafts' },
    update: {},
    create: { name: 'Ремесла та хендмейд', slug: 'crafts' },
  });

  console.log('Категорії створені.');

  // ===================== ТОВАРИ =====================

  await prisma.product.createMany({
    data: [
      {
        store_id: store.id,
        category_id: honeyCategory.id,
        name: 'Акацієвий мед',
        description: 'Світлий, ніжний мед з акації. Не кристалізується тривалий час.',
        price: 250.00,
        stock_qty: 50,
        status: ProductStatus.ACTIVE,
      },
      {
        store_id: store.id,
        category_id: honeyCategory.id,
        name: 'Гречаний мед',
        description: 'Насичений темний мед з вираженим смаком і ароматом гречки.',
        price: 220.00,
        stock_qty: 20,
        status: ProductStatus.ACTIVE,
      },
      {
        store_id: store.id,
        category_id: honeyCategory.id,
        name: 'Липовий мед',
        description: 'Класичний карпатський мед з липи. Ніжний аромат і золотистий колір.',
        price: 270.00,
        stock_qty: 35,
        status: ProductStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Товари створені.');

  // ===================== ПІДСУМОК =====================

  console.log('\n=== Seed завершено ===');
  console.log('Акаунти для входу:');
  console.log('  Адмін:     admin@marketplace.ua    / Admin123!');
  console.log('  Виробник:  producer@local.ua        / Producer123!');
  console.log('  Покупець:  buyer@email.com           / Buyer123!');
}

main()
  .catch((e) => {
    console.error('Помилка seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
