-- AlterTable
ALTER TABLE "product_authentication_requests" ADD COLUMN     "image_urls" TEXT[];

-- AlterTable
ALTER TABLE "products" DROP COLUMN "size",
ADD COLUMN     "brand" TEXT;

