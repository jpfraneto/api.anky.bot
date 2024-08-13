/*
  Warnings:

  - The primary key for the `Stream` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Stream` table. All the data in the column will be lost.
  - Made the column `streamId` on table `Stream` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Clip" DROP CONSTRAINT "Clip_streamId_fkey";

-- AlterTable
ALTER TABLE "Stream" DROP CONSTRAINT "Stream_pkey",
DROP COLUMN "id",
ADD COLUMN     "clipCreationIntervalId" TEXT,
ADD COLUMN     "description" TEXT,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "streamId" SET NOT NULL,
ADD CONSTRAINT "Stream_pkey" PRIMARY KEY ("streamId");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gifUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("streamId") ON DELETE RESTRICT ON UPDATE CASCADE;
