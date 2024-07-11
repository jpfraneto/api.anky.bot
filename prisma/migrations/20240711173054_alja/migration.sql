-- AlterTable
ALTER TABLE "ZurfUser" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "pfp" TEXT;

-- CreateTable
CREATE TABLE "Sadhana" (
    "id" TEXT NOT NULL,
    "parentCastHash" TEXT NOT NULL,
    "sadhanaCastHash" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationInDays" INTEGER NOT NULL,
    "betInDegen" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "replyToAcknowledgeSadhanaHash" TEXT,
    "userAccepted" BOOLEAN NOT NULL DEFAULT false,
    "userRejected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sadhana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SadhanaSessions" (
    "id" TEXT NOT NULL,
    "parentSadhanaId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "dmed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakAlive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SadhanaSessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sadhana_sadhanaCastHash_key" ON "Sadhana"("sadhanaCastHash");

-- AddForeignKey
ALTER TABLE "Sadhana" ADD CONSTRAINT "Sadhana_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaSessions" ADD CONSTRAINT "SadhanaSessions_parentSadhanaId_fkey" FOREIGN KEY ("parentSadhanaId") REFERENCES "Sadhana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
