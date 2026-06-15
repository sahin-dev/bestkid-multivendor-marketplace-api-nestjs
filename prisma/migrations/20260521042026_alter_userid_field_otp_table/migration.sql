/*
  Warnings:

  - The `userId` column on the `OtpVerification` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "OtpVerification" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER;
