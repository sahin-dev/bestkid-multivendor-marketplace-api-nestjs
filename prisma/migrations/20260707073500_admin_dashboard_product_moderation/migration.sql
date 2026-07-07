ALTER TABLE "products"
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "rejected_at" TIMESTAMP(3);

UPDATE "products"
SET "approved_at" = "updatedAt"
WHERE "authentication_status" = 'VERIFIED'
  AND "approved_at" IS NULL;

UPDATE "products"
SET "rejected_at" = "updatedAt"
WHERE "authentication_status" = 'NOT_VERIFIED'
  AND "rejected_at" IS NULL;
