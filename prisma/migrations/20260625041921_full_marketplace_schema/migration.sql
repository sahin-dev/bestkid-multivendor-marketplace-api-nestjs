/*
  Warnings:

  - Added the required column `sellerId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `return_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variantId" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_days_max" INTEGER,
ADD COLUMN     "delivery_days_min" INTEGER,
ADD COLUMN     "delivery_partner" TEXT,
ADD COLUMN     "sellerId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "images" TEXT[],
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "seller_delivery_options" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "domestic_partner" TEXT,
    "domestic_cost" DOUBLE PRECISION,
    "domestic_days_min" INTEGER,
    "domestic_days_max" INTEGER,
    "international_partner" TEXT,
    "international_cost" DOUBLE PRECISION,
    "international_days_min" INTEGER,
    "international_days_max" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_delivery_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recently_viewed" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_delivery_options_sellerId_key" ON "seller_delivery_options"("sellerId");

-- CreateIndex
CREATE INDEX "recently_viewed_userId_idx" ON "recently_viewed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_userId_productId_key" ON "recently_viewed"("userId", "productId");

-- CreateIndex
CREATE INDEX "orders_sellerId_idx" ON "orders"("sellerId");

-- CreateIndex
CREATE INDEX "return_requests_userId_idx" ON "return_requests"("userId");

-- CreateIndex
CREATE INDEX "return_requests_orderItemId_idx" ON "return_requests"("orderItemId");

-- AddForeignKey
ALTER TABLE "seller_delivery_options" ADD CONSTRAINT "seller_delivery_options_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
