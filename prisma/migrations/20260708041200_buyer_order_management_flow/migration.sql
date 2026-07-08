-- CreateEnum
CREATE TYPE "OrderCancellationActor" AS ENUM ('BUYER', 'SELLER', 'ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "orders"
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancelled_by_user_id" INTEGER,
ADD COLUMN "cancelled_by_actor" "OrderCancellationActor",
ADD COLUMN "cancellation_reason" TEXT;

-- AlterTable
ALTER TABLE "ProductReview"
ADD COLUMN "orderItemId" INTEGER;

-- CreateIndex
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_userId_idx" ON "ProductReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderItemId_key" ON "ProductReview"("orderItemId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_orderItemId_key" ON "return_requests"("orderItemId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
