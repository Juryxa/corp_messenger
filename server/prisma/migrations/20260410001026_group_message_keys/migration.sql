-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "encryptedKeySender" DROP NOT NULL;

-- CreateTable
CREATE TABLE "message_group_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "message_group_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_group_keys_messageId_userId_key" ON "message_group_keys"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "message_group_keys" ADD CONSTRAINT "message_group_keys_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
