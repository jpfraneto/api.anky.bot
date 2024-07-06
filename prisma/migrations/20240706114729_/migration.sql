/*
  Warnings:

  - You are about to drop the `Video` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Video";

-- CreateTable
CREATE TABLE "ZurfUser" (
    "fid" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "craft" TEXT NOT NULL,

    CONSTRAINT "ZurfUser_pkey" PRIMARY KEY ("fid")
);

-- CreateTable
CREATE TABLE "ZurfVideo" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "gifLink" TEXT NOT NULL,
    "videoLink" TEXT,
    "castHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "zurfUserFid" INTEGER,

    CONSTRAINT "ZurfVideo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ZurfVideo" ADD CONSTRAINT "ZurfVideo_zurfUserFid_fkey" FOREIGN KEY ("zurfUserFid") REFERENCES "ZurfUser"("fid") ON DELETE SET NULL ON UPDATE CASCADE;
