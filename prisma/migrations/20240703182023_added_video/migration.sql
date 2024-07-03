-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "videoPath" TEXT NOT NULL,
    "gifPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);
