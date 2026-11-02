-- AlterEnum
ALTER TYPE "LaundryUnit" ADD VALUE 'SZT_KG';

-- AlterTable
ALTER TABLE "LaundryRouteEntry" ADD COLUMN     "weightKg" DOUBLE PRECISION;
