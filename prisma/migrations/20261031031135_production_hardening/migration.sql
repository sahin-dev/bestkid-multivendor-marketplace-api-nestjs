-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reserved_by_user_id" INTEGER,
ADD COLUMN     "reserved_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "payment_transactions_status_createdAt_idx" ON "payment_transactions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_transactions_stripe_payment_intent_id_idx" ON "payment_transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "products_status_createdAt_idx" ON "products"("status", "createdAt");

-- CreateIndex
CREATE INDEX "products_userId_status_idx" ON "products"("userId", "status");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_subCategoryId_idx" ON "products"("subCategoryId");
