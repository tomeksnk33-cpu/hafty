-- Zdjęcia (wzory) przy każdym logo, osobno od zdjęć asortymentu.
-- CreateTable
CREATE TABLE "OrderLogoPhoto" (
    "id" TEXT NOT NULL,
    "logoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLogoPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTemplateLogoPhoto" (
    "id" TEXT NOT NULL,
    "logoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderTemplateLogoPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLogoPhoto_logoId_idx" ON "OrderLogoPhoto"("logoId");

-- CreateIndex
CREATE INDEX "OrderTemplateLogoPhoto_logoId_idx" ON "OrderTemplateLogoPhoto"("logoId");

-- AddForeignKey
ALTER TABLE "OrderLogoPhoto" ADD CONSTRAINT "OrderLogoPhoto_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "OrderLogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTemplateLogoPhoto" ADD CONSTRAINT "OrderTemplateLogoPhoto_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "OrderTemplateLogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

