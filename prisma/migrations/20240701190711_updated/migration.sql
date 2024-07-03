/*
  Warnings:

  - You are about to drop the column `collectorId` on the `ReplyForTrainingAnky` table. All the data in the column will be lost.
  - You are about to drop the column `engagementScore` on the `ReplyForTrainingAnky` table. All the data in the column will be lost.
  - Added the required column `dayOfStorage` to the `ReplyForTrainingAnky` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ReplyForTrainingAnky" DROP COLUMN "collectorId",
DROP COLUMN "engagementScore",
ADD COLUMN     "collectorFid" INTEGER,
ADD COLUMN     "dayOfStorage" INTEGER NOT NULL;
