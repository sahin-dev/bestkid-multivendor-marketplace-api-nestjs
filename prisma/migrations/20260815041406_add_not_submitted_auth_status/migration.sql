-- AlterEnum
ALTER TYPE "AuthenticationStatus" ADD VALUE 'NOT_SUBMITTED';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "authentication_status" SET DEFAULT 'NOT_SUBMITTED';
