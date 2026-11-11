-- CreateTable
CREATE TABLE "LaundrySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hideVoice" BOOLEAN NOT NULL DEFAULT false,
    "hideRouteDate" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundrySettings_pkey" PRIMARY KEY ("id")
);

