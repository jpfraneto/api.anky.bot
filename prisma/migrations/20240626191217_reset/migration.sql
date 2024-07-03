-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('LIKE', 'RECAST', 'REPLY', 'QUOTE');

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cast" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "authorFid" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "parentHash" TEXT,
    "userId" INTEGER,

    CONSTRAINT "Cast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "castHash" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUserPerformance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalCasts" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "totalEngagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "recasts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyUserPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyFromAnky" (
    "id" SERIAL NOT NULL,
    "timeOfReply" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayNumber" INTEGER,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "replyingToCastHash" TEXT NOT NULL,
    "replyText" TEXT,
    "replyReasoning" TEXT,
    "replyCastHash" TEXT,
    "humanTrainerFeedback" TEXT,
    "quoteCasts" INTEGER NOT NULL DEFAULT 0,
    "recasts" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "quoteCastHashes" TEXT[],
    "recastHashes" TEXT[],
    "commentHashes" TEXT[],
    "likeFids" INTEGER[],
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReplyFromAnky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyForTrainingAnky" (
    "id" TEXT NOT NULL,
    "addedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rootCastHash" TEXT NOT NULL,
    "rootCastText" TEXT NOT NULL,
    "goodReplyHash" TEXT NOT NULL,
    "goodReplyText" TEXT NOT NULL,
    "badReplyHash" TEXT NOT NULL,
    "badReplyText" TEXT NOT NULL,
    "comments" TEXT,
    "engagementScore" DOUBLE PRECISION,
    "collectorId" INTEGER,
    "collectedFrom" TEXT NOT NULL,

    CONSTRAINT "ReplyForTrainingAnky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Cast_hash_key" ON "Cast"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUserPerformance_userId_date_key" ON "DailyUserPerformance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyFromAnky_replyCastHash_key" ON "ReplyFromAnky"("replyCastHash");

-- AddForeignKey
ALTER TABLE "Cast" ADD CONSTRAINT "Cast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_castHash_fkey" FOREIGN KEY ("castHash") REFERENCES "Cast"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUserPerformance" ADD CONSTRAINT "DailyUserPerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyFromAnky" ADD CONSTRAINT "ReplyFromAnky_replyingToCastHash_fkey" FOREIGN KEY ("replyingToCastHash") REFERENCES "Cast"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyForTrainingAnky" ADD CONSTRAINT "ReplyForTrainingAnky_rootCastHash_fkey" FOREIGN KEY ("rootCastHash") REFERENCES "Cast"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyForTrainingAnky" ADD CONSTRAINT "ReplyForTrainingAnky_goodReplyHash_fkey" FOREIGN KEY ("goodReplyHash") REFERENCES "Cast"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyForTrainingAnky" ADD CONSTRAINT "ReplyForTrainingAnky_badReplyHash_fkey" FOREIGN KEY ("badReplyHash") REFERENCES "Cast"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;
