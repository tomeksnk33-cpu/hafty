-- Szablony zleceń klientów haftów.
-- AlterTable
ALTER TABLE "EmbroideryOrder" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "OrderTemplate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "product" TEXT NOT NULL,
    "placements" "OrderPlacement"[],
    "placementNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTemplatePhoto" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTemplatePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTemplate_clientId_name_idx" ON "OrderTemplate"("clientId", "name");

-- CreateIndex
CREATE INDEX "OrderTemplatePhoto_templateId_idx" ON "OrderTemplatePhoto"("templateId");

-- AddForeignKey
ALTER TABLE "EmbroideryOrder" ADD CONSTRAINT "EmbroideryOrder_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OrderTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTemplate" ADD CONSTRAINT "OrderTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTemplatePhoto" ADD CONSTRAINT "OrderTemplatePhoto_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OrderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

