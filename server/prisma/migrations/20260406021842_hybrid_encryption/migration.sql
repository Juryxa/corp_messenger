/*
  Warnings:

  - You are about to drop the column `senderText` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `messages` table. All the data in the column will be lost.
  - Added the required column `encryptedKeySender` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedText` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messages" DROP COLUMN "senderText",
DROP COLUMN "text",
ADD COLUMN     "encryptedKeyRecipient" TEXT,
ADD COLUMN     "encryptedKeySender" TEXT NOT NULL,
ADD COLUMN     "encryptedText" TEXT NOT NULL;
