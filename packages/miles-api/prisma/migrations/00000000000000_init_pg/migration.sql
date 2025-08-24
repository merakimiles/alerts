-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertType" TEXT NOT NULL,
    "severity" TEXT,
    "organizationId" TEXT,
    "networkId" TEXT,
    "deviceSerial" TEXT,
    "deviceMac" TEXT,
    "deviceName" TEXT,
    "clientMac" TEXT,
    "imageUrl" TEXT,
    "details" TEXT,
    "raw" JSONB NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_dedupeKey_key" ON "Event"("dedupeKey");

-- CreateIndex
CREATE INDEX "Event_occurredAt_idx" ON "Event"("occurredAt");

-- CreateIndex
CREATE INDEX "Event_alertType_idx" ON "Event"("alertType");

