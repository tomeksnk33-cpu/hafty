-- CreateEnum
CREATE TYPE "LaundryUnit" AS ENUM ('SZT', 'KG');

-- AlterTable
ALTER TABLE "LaundryCatalogEntry" ADD COLUMN     "unit" "LaundryUnit" NOT NULL DEFAULT 'SZT';

-- AlterTable
ALTER TABLE "LaundryRouteEntry" ADD COLUMN     "unit" "LaundryUnit" NOT NULL DEFAULT 'SZT',
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
