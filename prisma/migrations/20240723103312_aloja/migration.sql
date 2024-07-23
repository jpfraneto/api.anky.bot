-- CreateTable
CREATE TABLE "FailedCast" (
    "id" TEXT NOT NULL,
    "castOptions" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedCast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedCast_attempts_idx" ON "FailedCast"("attempts");
