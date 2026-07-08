-- Seller order timeline fields for customer-order management screens.
ALTER TABLE "orders"
ADD COLUMN "confirmed_at" TIMESTAMP(3),
ADD COLUMN "processing_at" TIMESTAMP(3),
ADD COLUMN "shipped_at" TIMESTAMP(3),
ADD COLUMN "delivered_at" TIMESTAMP(3);

-- Seller return-resolution fields for completed/refunded return screens.
ALTER TABLE "return_requests"
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "refunded_at" TIMESTAMP(3),
ADD COLUMN "refund_amount" DOUBLE PRECISION;
