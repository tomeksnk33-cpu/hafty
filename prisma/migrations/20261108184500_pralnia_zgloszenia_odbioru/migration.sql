-- CreateEnum
CREATE TYPE "LaundryPickupSource" AS ENUM ('SMS', 'MANUAL');

-- AlterTable
ALTER TABLE "LaundryCatalogEntry" ADD COLUMN     "phones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "LaundryPickup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "source" "LaundryPickupSource" NOT NULL DEFAULT 'MANUAL',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,

    CONSTRAINT "LaundryPickup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaundryPickup_doneAt_createdAt_idx" ON "LaundryPickup"("doneAt", "createdAt");

-- AddForeignKey
ALTER TABLE "LaundryPickup" ADD CONSTRAINT "LaundryPickup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LaundryCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
