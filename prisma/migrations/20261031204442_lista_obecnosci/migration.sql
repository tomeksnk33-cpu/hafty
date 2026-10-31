-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canUseAttendance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AttendancePerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceShift" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "startDevice" TEXT,
    "endDevice" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceShift_startedAt_idx" ON "AttendanceShift"("startedAt");

-- CreateIndex
CREATE INDEX "AttendanceShift_personId_endedAt_idx" ON "AttendanceShift"("personId", "endedAt");

-- AddForeignKey
ALTER TABLE "AttendanceShift" ADD CONSTRAINT "AttendanceShift_personId_fkey" FOREIGN KEY ("personId") REFERENCES "AttendancePerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
