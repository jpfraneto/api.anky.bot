-- CreateTable
CREATE TABLE "CastWithVideo" (
    "id" SERIAL NOT NULL,
    "castHash" TEXT NOT NULL,
    "gifUrl" TEXT NOT NULL,
    "videoDuration" DOUBLE PRECISION NOT NULL,
    "gifDuration" DOUBLE PRECISION NOT NULL,
    "fps" DOUBLE PRECISION NOT NULL,
    "scale" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastWithVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CastWithVideo_castHash_key" ON "CastWithVideo"("castHash");
