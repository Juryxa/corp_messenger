/*
  Warnings:

  - You are about to drop the column `login` on the `users` table. All the data in the column will be lost.
  - Added the required column `role` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user');

-- DropIndex
DROP INDEX "users_login_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "login",
ADD COLUMN     "role" "Role" NOT NULL;
