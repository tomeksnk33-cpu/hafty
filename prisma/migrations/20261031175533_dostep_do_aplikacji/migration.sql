-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canUseEmbroidery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canUseLaundry" BOOLEAN NOT NULL DEFAULT true;
