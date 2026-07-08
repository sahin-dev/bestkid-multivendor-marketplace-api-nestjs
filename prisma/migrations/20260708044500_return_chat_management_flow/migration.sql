-- AlterEnum
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- AlterTable
ALTER TABLE "return_requests"
ADD COLUMN "message" TEXT,
ADD COLUMN "seller_response" TEXT,
ADD COLUMN "seller_rejection_reason" TEXT,
ADD COLUMN "return_address" TEXT,
ADD COLUMN "resolved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_rooms"
ADD COLUMN "buyer_deleted_at" TIMESTAMP(3),
ADD COLUMN "seller_deleted_at" TIMESTAMP(3),
ADD COLUMN "blocked_by_user_id" INTEGER,
ADD COLUMN "blocked_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_buyerId_sellerId_key" ON "chat_rooms"("buyerId", "sellerId");
