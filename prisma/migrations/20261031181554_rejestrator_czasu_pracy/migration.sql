-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canUseTimeclock" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RcpPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RcpPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcpTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "norm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RcpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcpPunch" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "RcpPunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcpWork" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "norm" DOUBLE PRECISION NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "RcpWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcpRecognition" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION,
    "ts" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "RcpRecognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcpSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RcpSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RcpVersion" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RcpVersion_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RcpPunch_day_idx" ON "RcpPunch"("day");

-- CreateIndex
CREATE INDEX "RcpPunch_personId_ts_idx" ON "RcpPunch"("personId", "ts");

-- CreateIndex
CREATE INDEX "RcpWork_day_idx" ON "RcpWork"("day");

-- CreateIndex
CREATE INDEX "RcpRecognition_day_idx" ON "RcpRecognition"("day");
