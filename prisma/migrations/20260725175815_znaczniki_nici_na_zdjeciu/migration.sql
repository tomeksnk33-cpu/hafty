-- AlterTable
ALTER TABLE "RealizationThread" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ThreadMarker" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ThreadMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThreadMarker_photoId_idx" ON "ThreadMarker"("photoId");

-- CreateIndex
CREATE INDEX "ThreadMarker_threadId_idx" ON "ThreadMarker"("threadId");

-- AddForeignKey
ALTER TABLE "ThreadMarker" ADD CONSTRAINT "ThreadMarker_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMarker" ADD CONSTRAINT "ThreadMarker_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
