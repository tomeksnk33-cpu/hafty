-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "colorName" TEXT,
    "hex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Realization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "executedAt" DATE NOT NULL,
    "clientId" TEXT,
    "productType" TEXT,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "stitchCount" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceGr" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Realization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "realizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignFile" (
    "id" TEXT NOT NULL,
    "realizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealizationThread" (
    "realizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "RealizationThread_pkey" PRIMARY KEY ("realizationId","threadId")
);

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Thread_number_idx" ON "Thread"("number");

-- CreateIndex
CREATE INDEX "Thread_colorName_idx" ON "Thread"("colorName");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_brand_number_key" ON "Thread"("brand", "number");

-- CreateIndex
CREATE INDEX "Realization_name_idx" ON "Realization"("name");

-- CreateIndex
CREATE INDEX "Realization_executedAt_idx" ON "Realization"("executedAt");

-- CreateIndex
CREATE INDEX "Realization_clientId_idx" ON "Realization"("clientId");

-- CreateIndex
CREATE INDEX "Realization_productType_idx" ON "Realization"("productType");

-- CreateIndex
CREATE INDEX "Photo_realizationId_position_idx" ON "Photo"("realizationId", "position");

-- CreateIndex
CREATE INDEX "DesignFile_realizationId_idx" ON "DesignFile"("realizationId");

-- CreateIndex
CREATE INDEX "RealizationThread_threadId_idx" ON "RealizationThread"("threadId");

-- AddForeignKey
ALTER TABLE "Realization" ADD CONSTRAINT "Realization_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "Realization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFile" ADD CONSTRAINT "DesignFile_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "Realization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizationThread" ADD CONSTRAINT "RealizationThread_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "Realization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizationThread" ADD CONSTRAINT "RealizationThread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
