-- AlterEnum
BEGIN;
CREATE TYPE "ProductStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD');
ALTER TABLE "public"."products" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "status" TYPE "ProductStatus_new" USING ("status"::text::"ProductStatus_new");
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
DROP TYPE "public"."ProductStatus_old";
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'INACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_variantId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_variantId_fkey";

-- DropForeignKey
ALTER TABLE "return_requests" DROP CONSTRAINT "return_requests_orderItemId_fkey";

-- DropIndex
DROP INDEX "cart_items_variantId_idx";

-- DropIndex
DROP INDEX "order_items_variantId_idx";

-- AlterTable
ALTER TABLE "cart_items" DROP COLUMN "quantity",
DROP COLUMN "variantId";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "quantity",
DROP COLUMN "variantId";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "size" TEXT,
ADD COLUMN     "sold_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "ProductVariant";

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_key" ON "cart_items"("cartId", "productId");

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

