CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TYPE "CouponUsageType" AS ENUM ('UNLIMITED', 'LIMITED');

CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "campaign_reason" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" INTEGER,
    "subCategoryId" INTEGER,
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "usage_type" "CouponUsageType" NOT NULL DEFAULT 'UNLIMITED',
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_code_idx" ON "coupons"("code");
CREATE INDEX "coupons_categoryId_idx" ON "coupons"("categoryId");
CREATE INDEX "coupons_subCategoryId_idx" ON "coupons"("subCategoryId");
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "ContactStatus" RENAME TO "ContactStatus_old";
CREATE TYPE "ContactStatus" AS ENUM ('TO_DO', 'RESOLVED');

ALTER TABLE "contact_requests"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "ContactStatus"
USING (
    CASE
        WHEN "status"::text = 'REPLIED' THEN 'RESOLVED'::"ContactStatus"
        ELSE 'TO_DO'::"ContactStatus"
    END
);

ALTER TABLE "contact_requests" ALTER COLUMN "status" SET DEFAULT 'TO_DO';
DROP TYPE "ContactStatus_old";
