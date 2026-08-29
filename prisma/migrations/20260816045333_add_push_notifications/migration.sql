-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RETURN';
ALTER TYPE "NotificationType" ADD VALUE 'AUTHENTICATION';

-- CreateTable
CREATE TABLE "user_device_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT DEFAULT 'ANDROID',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER,
    "tokenId" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_device_tokens_userId_isActive_idx" ON "user_device_tokens"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_userId_token_key" ON "user_device_tokens"("userId", "token");

-- CreateIndex
CREATE INDEX "push_notification_logs_userId_status_nextAttemptAt_idx" ON "push_notification_logs"("userId", "status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "user_device_tokens" ADD CONSTRAINT "user_device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "user_device_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
