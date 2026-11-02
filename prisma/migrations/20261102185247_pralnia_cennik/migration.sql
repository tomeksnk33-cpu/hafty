-- CreateTable
CREATE TABLE "LaundryPrice" (
    "clientId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "perPiece" DOUBLE PRECISION,
    "perKg" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundryPrice_pkey" PRIMARY KEY ("clientId","itemId")
);

-- CreateIndex
CREATE INDEX "LaundryPrice_itemId_idx" ON "LaundryPrice"("itemId");

-- AddForeignKey
ALTER TABLE "LaundryPrice" ADD CONSTRAINT "LaundryPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LaundryCatalogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryPrice" ADD CONSTRAINT "LaundryPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LaundryCatalogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
