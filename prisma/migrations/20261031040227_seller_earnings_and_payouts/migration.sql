-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "platform_fee_percent" DOUBLE PRECISION,
ADD COLUMN     "seller_net_amount" DOUBLE PRECISION,
ADD COLUMN     "seller_payout_at" TIMESTAMP(3),
ADD COLUMN     "seller_payout_reference" TEXT;
