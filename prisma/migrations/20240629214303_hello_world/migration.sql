/*
  Warnings:

  - You are about to drop the column `commentHashes` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `dayNumber` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `deleted` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `likeFids` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `quoteCastHashes` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `recastHashes` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `ReplyFromAnky` table. All the data in the column will be lost.
  - You are about to drop the column `timeOfReply` on the `ReplyFromAnky` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ReplyFromAnky" DROP COLUMN "commentHashes",
DROP COLUMN "dayNumber",
DROP COLUMN "deleted",
DROP COLUMN "likeFids",
DROP COLUMN "quoteCastHashes",
DROP COLUMN "recastHashes",
DROP COLUMN "scheduledAt",
DROP COLUMN "timeOfReply",
ADD COLUMN     "chronologicalDayNumber" INTEGER,
ADD COLUMN     "deletedFromFarcaster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kingdom" TEXT,
ADD COLUMN     "momentOfReply" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sojourn" TEXT;
