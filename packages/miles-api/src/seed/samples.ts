import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function sha256(input: string) { return crypto.createHash('sha256').update(input).digest('hex'); }

async function main() {
  const now = new Date();
  const samples = [
    {
      alertType: 'MV Motion Recap',
      severity: 'Info',
      organizationId: 'org_1',
      networkId: 'N_123',
      deviceSerial: 'Q2GV-ABCD-1234',
      deviceName: 'Lobby Cam',
      occurredAt: new Date(now.getTime() - 60_000).toISOString(),
      sentAt: now.toISOString(),
      sharedSecret: process.env.MILES_SHARED_SECRET || '',
      imageUrl: 'https://placehold.co/160x90/png',
      text: 'Motion recap available',
      alertId: 'seed-1'
    },
  ];

  for (const s of samples) {
    const raw = JSON.stringify(s);
    const dedupeKey = s.alertId || sha256(`${raw}|${s.sentAt}`);
    await prisma.event.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        occurredAt: new Date(s.occurredAt),
        alertType: s.alertType,
        severity: s.severity,
        organizationId: s.organizationId,
        networkId: s.networkId,
        deviceSerial: s.deviceSerial,
        deviceName: s.deviceName,
        imageUrl: s.imageUrl,
        details: s.text,
        raw: s as any,
      },
      update: {
        alertType: s.alertType,
        details: s.text,
      },
    });
  }
  console.log('Seeded sample events');
}

main().finally(async () => prisma.$disconnect());


