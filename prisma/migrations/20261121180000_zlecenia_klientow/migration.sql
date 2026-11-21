-- Konta klientów haftów i ich zlecenia.

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('HAFT', 'DTF');

-- CreateEnum
CREATE TYPE "OrderPlacement" AS ENUM ('PLECY', 'PRZOD_LEWY', 'PRZOD_PRAWY', 'REKAW');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NOWE', 'W_REALIZACJI', 'GOTOWE', 'ANULOWANE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "EmbroideryOrder" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT,
    "kind" "OrderKind" NOT NULL,
    "product" TEXT NOT NULL,
    "placements" "OrderPlacement"[],
    "placementNotes" TEXT,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NOWE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbroideryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPhoto" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmbroideryOrder_number_key" ON "EmbroideryOrder"("number");

-- CreateIndex
CREATE INDEX "EmbroideryOrder_clientId_createdAt_idx" ON "EmbroideryOrder"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "EmbroideryOrder_status_createdAt_idx" ON "EmbroideryOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPhoto_orderId_idx" ON "OrderPhoto"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clientId_key" ON "User"("clientId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbroideryOrder" ADD CONSTRAINT "EmbroideryOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbroideryOrder" ADD CONSTRAINT "EmbroideryOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EmbroideryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

