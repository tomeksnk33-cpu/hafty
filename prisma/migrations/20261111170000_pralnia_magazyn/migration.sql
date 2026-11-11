-- CreateEnum
CREATE TYPE "LaundryStockKind" AS ENUM ('WASHED', 'DELIVERED', 'CORRECTION');

-- AlterTable
ALTER TABLE "LaundryCatalogEntry" ADD COLUMN     "lineId" TEXT;

-- AlterTable
ALTER TABLE "LaundryRoute" ADD COLUMN     "lineName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isLaundryDriver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LaundryLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryStockMove" (
    "id" TEXT NOT NULL,
    "kind" "LaundryStockKind" NOT NULL,
    "clientName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" "LaundryUnit" NOT NULL DEFAULT 'SZT',
    "quantity" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "workerName" TEXT NOT NULL,
    "userId" TEXT,
    "batchId" TEXT,
    "routeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryStockMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaundryLine_name_key" ON "LaundryLine"("name");

-- CreateIndex
CREATE INDEX "LaundryStockMove_clientName_itemName_idx" ON "LaundryStockMove"("clientName", "itemName");

-- CreateIndex
CREATE INDEX "LaundryStockMove_batchId_idx" ON "LaundryStockMove"("batchId");

-- CreateIndex
CREATE INDEX "LaundryStockMove_createdAt_idx" ON "LaundryStockMove"("createdAt");

-- AddForeignKey
ALTER TABLE "LaundryCatalogEntry" ADD CONSTRAINT "LaundryCatalogEntry_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "LaundryLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryStockMove" ADD CONSTRAINT "LaundryStockMove_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "LaundryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

