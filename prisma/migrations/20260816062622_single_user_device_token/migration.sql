/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `user_device_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_device_tokens_userId_token_key";

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_userId_key" ON "user_device_tokens"("userId");
