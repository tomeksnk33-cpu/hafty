-- AlterTable
ALTER TABLE "LaundryCatalogEntry" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locatedAt" TIMESTAMP(3),
ADD COLUMN     "locatedBy" TEXT,
ADD COLUMN     "locationAccuracy" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
