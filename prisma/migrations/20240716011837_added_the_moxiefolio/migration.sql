-- AlterTable
ALTER TABLE "User" ADD COLUMN     "moxieAirdropAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MoxieFantoken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoxieFantoken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoxieFantokenEntry" (
    "id" SERIAL NOT NULL,
    "moxieFantokenId" INTEGER NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "allocation" DOUBLE PRECISION NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoxieFantokenEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoxieFantoken_userId_key" ON "MoxieFantoken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MoxieFantokenEntry_moxieFantokenId_targetUserId_key" ON "MoxieFantokenEntry"("moxieFantokenId", "targetUserId");

-- AddForeignKey
ALTER TABLE "MoxieFantoken" ADD CONSTRAINT "MoxieFantoken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoxieFantokenEntry" ADD CONSTRAINT "MoxieFantokenEntry_moxieFantokenId_fkey" FOREIGN KEY ("moxieFantokenId") REFERENCES "MoxieFantoken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoxieFantokenEntry" ADD CONSTRAINT "MoxieFantokenEntry_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
