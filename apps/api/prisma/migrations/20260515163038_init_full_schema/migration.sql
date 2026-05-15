-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "STORES" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "STORES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "STORE_DOCS" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "doc_url" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "STORE_DOCS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CATEGORIES" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "CATEGORIES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRODUCTS" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRODUCTS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRODUCT_IMAGES" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PRODUCT_IMAGES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ORDERS" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "store_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "delivery_method" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_number" TEXT,
    "guest_name" TEXT,
    "guest_email" TEXT,
    "guest_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ORDERS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ORDER_ITEMS" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ORDER_ITEMS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ORDER_ADDRESSES" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,

    CONSTRAINT "ORDER_ADDRESSES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "REVIEWS" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "REVIEWS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MESSAGES" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "order_id" TEXT,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MESSAGES_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WISHLISTS" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WISHLISTS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SUPPORT_TICKETS" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SUPPORT_TICKETS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TICKET_MESSAGES" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TICKET_MESSAGES_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "STORES_user_id_key" ON "STORES"("user_id");

-- CreateIndex
CREATE INDEX "STORES_user_id_idx" ON "STORES"("user_id");

-- CreateIndex
CREATE INDEX "STORE_DOCS_store_id_idx" ON "STORE_DOCS"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "CATEGORIES_slug_key" ON "CATEGORIES"("slug");

-- CreateIndex
CREATE INDEX "CATEGORIES_parent_id_idx" ON "CATEGORIES"("parent_id");

-- CreateIndex
CREATE INDEX "PRODUCTS_store_id_idx" ON "PRODUCTS"("store_id");

-- CreateIndex
CREATE INDEX "PRODUCTS_category_id_idx" ON "PRODUCTS"("category_id");

-- CreateIndex
CREATE INDEX "PRODUCT_IMAGES_product_id_idx" ON "PRODUCT_IMAGES"("product_id");

-- CreateIndex
CREATE INDEX "ORDERS_buyer_id_idx" ON "ORDERS"("buyer_id");

-- CreateIndex
CREATE INDEX "ORDERS_store_id_idx" ON "ORDERS"("store_id");

-- CreateIndex
CREATE INDEX "ORDER_ITEMS_order_id_idx" ON "ORDER_ITEMS"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ORDER_ADDRESSES_order_id_key" ON "ORDER_ADDRESSES"("order_id");

-- CreateIndex
CREATE INDEX "REVIEWS_product_id_idx" ON "REVIEWS"("product_id");

-- CreateIndex
CREATE INDEX "REVIEWS_user_id_idx" ON "REVIEWS"("user_id");

-- CreateIndex
CREATE INDEX "MESSAGES_sender_id_idx" ON "MESSAGES"("sender_id");

-- CreateIndex
CREATE INDEX "MESSAGES_receiver_id_idx" ON "MESSAGES"("receiver_id");

-- CreateIndex
CREATE INDEX "MESSAGES_order_id_idx" ON "MESSAGES"("order_id");

-- CreateIndex
CREATE INDEX "WISHLISTS_user_id_idx" ON "WISHLISTS"("user_id");

-- CreateIndex
CREATE INDEX "SUPPORT_TICKETS_user_id_idx" ON "SUPPORT_TICKETS"("user_id");

-- CreateIndex
CREATE INDEX "TICKET_MESSAGES_ticket_id_idx" ON "TICKET_MESSAGES"("ticket_id");

-- CreateIndex
CREATE INDEX "USERS_email_idx" ON "USERS"("email");

-- AddForeignKey
ALTER TABLE "STORES" ADD CONSTRAINT "STORES_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "STORE_DOCS" ADD CONSTRAINT "STORE_DOCS_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "STORES"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CATEGORIES" ADD CONSTRAINT "CATEGORIES_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "CATEGORIES"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRODUCTS" ADD CONSTRAINT "PRODUCTS_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "STORES"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRODUCTS" ADD CONSTRAINT "PRODUCTS_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "CATEGORIES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRODUCT_IMAGES" ADD CONSTRAINT "PRODUCT_IMAGES_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "PRODUCTS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORDERS" ADD CONSTRAINT "ORDERS_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "USERS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORDERS" ADD CONSTRAINT "ORDERS_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "STORES"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORDER_ITEMS" ADD CONSTRAINT "ORDER_ITEMS_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ORDERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORDER_ITEMS" ADD CONSTRAINT "ORDER_ITEMS_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "PRODUCTS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORDER_ADDRESSES" ADD CONSTRAINT "ORDER_ADDRESSES_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ORDERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REVIEWS" ADD CONSTRAINT "REVIEWS_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "PRODUCTS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REVIEWS" ADD CONSTRAINT "REVIEWS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REVIEWS" ADD CONSTRAINT "REVIEWS_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ORDERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESSAGES" ADD CONSTRAINT "MESSAGES_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESSAGES" ADD CONSTRAINT "MESSAGES_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESSAGES" ADD CONSTRAINT "MESSAGES_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ORDERS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WISHLISTS" ADD CONSTRAINT "WISHLISTS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WISHLISTS" ADD CONSTRAINT "WISHLISTS_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "PRODUCTS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SUPPORT_TICKETS" ADD CONSTRAINT "SUPPORT_TICKETS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TICKET_MESSAGES" ADD CONSTRAINT "TICKET_MESSAGES_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "SUPPORT_TICKETS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TICKET_MESSAGES" ADD CONSTRAINT "TICKET_MESSAGES_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "USERS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
