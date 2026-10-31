-- CreateEnum
CREATE TYPE "LaundryCatalogKind" AS ENUM ('CLIENT', 'ITEM');

-- CreateTable
CREATE TABLE "LaundryCatalogEntry" (
    "id" TEXT NOT NULL,
    "kind" "LaundryCatalogKind" NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundryCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workerName" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "mailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryRouteEntry" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "LaundryRouteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaundryCatalogEntry_kind_name_idx" ON "LaundryCatalogEntry"("kind", "name");

-- CreateIndex
CREATE INDEX "LaundryRoute_finishedAt_idx" ON "LaundryRoute"("finishedAt");

-- CreateIndex
CREATE INDEX "LaundryRouteEntry_routeId_position_idx" ON "LaundryRouteEntry"("routeId", "position");

-- AddForeignKey
ALTER TABLE "LaundryRoute" ADD CONSTRAINT "LaundryRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryRouteEntry" ADD CONSTRAINT "LaundryRouteEntry_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "LaundryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
