/*
  Warnings:

  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `providerId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `chatbot_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "chatbot_logs" DROP CONSTRAINT "chatbot_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "provider",
DROP COLUMN "providerId";

-- DropTable
DROP TABLE "chatbot_logs";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "PaymentStatus";
