-- CreateEnum
CREATE TYPE "VideoProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');

-- AlterTable
ALTER TABLE "CastWithVideo" ADD COLUMN     "addedByFid" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" "VideoProcessingStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "gifUrl" DROP NOT NULL,
ALTER COLUMN "videoDuration" DROP NOT NULL,
ALTER COLUMN "gifDuration" DROP NOT NULL,
ALTER COLUMN "fps" DROP NOT NULL,
ALTER COLUMN "scale" DROP NOT NULL;
