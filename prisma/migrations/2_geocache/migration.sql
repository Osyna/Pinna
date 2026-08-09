-- CreateTable
CREATE TABLE "GeoCache" (
    "key" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 200,
    "body" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "GeoCache_expiresAt_idx" ON "GeoCache"("expiresAt");

