/*
  Warnings:

  - Changed the type of `purpose` on the `OtpVerification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'RESET_PASSWORD');

-- AlterTable
ALTER TABLE "OtpVerification" DROP COLUMN "purpose",
ADD COLUMN     "purpose" "OtpPurpose" NOT NULL;
