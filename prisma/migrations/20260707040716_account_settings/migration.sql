-- CreateEnum
CREATE TYPE "LanguagePreference" AS ENUM ('EN', 'BG');

-- CreateEnum
CREATE TYPE "CurrencyPreference" AS ENUM ('USD', 'EUR', 'AED', 'GBP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currency_preference" "CurrencyPreference" NOT NULL DEFAULT 'USD',
ADD COLUMN     "language_preference" "LanguagePreference" NOT NULL DEFAULT 'EN';

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "address_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_addresses_userId_idx" ON "user_addresses"("userId");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
