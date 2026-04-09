/*
  Warnings:

  - You are about to drop the `call_participants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `calls` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "call_participants" DROP CONSTRAINT "call_participants_callId_fkey";

-- DropForeignKey
ALTER TABLE "call_participants" DROP CONSTRAINT "call_participants_userId_fkey";

-- DropForeignKey
ALTER TABLE "calls" DROP CONSTRAINT "calls_chatId_fkey";

-- DropTable
DROP TABLE "call_participants";

-- DropTable
DROP TABLE "calls";

-- DropEnum
DROP TYPE "CallStatus";

-- DropEnum
DROP TYPE "CallType";

-- DropEnum
DROP TYPE "ParticipantStatus";
