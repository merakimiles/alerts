-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "raw" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_dedupeKey_key" ON "Event"("dedupeKey");

-- CreateIndex
CREATE INDEX "Event_occurredAt_idx" ON "Event"("occurredAt");

-- CreateIndex
CREATE INDEX "Event_alertType_idx" ON "Event"("alertType");
