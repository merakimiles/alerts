import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient, Event as EventModel, Prisma } from '@prisma/client';
import crypto from 'crypto';

type AnyRecord = Record<string, any>;

const prisma = new PrismaClient();

const app = express();

// Capture raw body for hashing
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(cors());

const PORT = parseInt(process.env.PORT || process.env.MILES_PORT || '8080', 10);
const SHARED_SECRET = process.env.MILES_SHARED_SECRET || process.env.MERAKI_SHARED_SECRET || '';
const HEADER_NAME = process.env.MILES_HEADER_NAME || process.env.MERAKI_HEADER_NAME || '';
const EXPECTED_HEADER_VALUE = process.env.MILES_EXPECTED_HEADER_VALUE || process.env.MERAKI_EXPECTED_HEADER_VALUE || '';
const ADMIN_TOKEN = process.env.MILES_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '';
const IP_ALLOWLIST = (process.env.MILES_WEBHOOK_IP_ALLOWLIST || process.env.WEBHOOK_IP_ALLOWLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isSQLite = (process.env.DATABASE_URL || '').startsWith('file:') || (process.env.DATABASE_URL || '').startsWith('sqlite:');

type SSEClient = { id: number; res: Response };
const sseClients = new Map<number, SSEClient>();
let sseIdSeq = 1;

function sendSseEvent(event: EventModel) {
  const data = JSON.stringify(event);
  for (const { res } of sseClients.values()) {
    res.write(`event: event\n`);
    res.write(`data: ${data}\n\n`);
  }
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getClientIps(req: Request): string[] {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  const proxyIps = xff.split(',').map((s) => s.trim()).filter(Boolean);
  const remote = req.socket?.remoteAddress ? [req.socket.remoteAddress] : [];
  return [...proxyIps, ...remote];
}

function isIpAllowed(req: Request): boolean {
  if (IP_ALLOWLIST.length === 0) return true;
  const ips = getClientIps(req);
  return ips.some((ip) => IP_ALLOWLIST.includes(ip));
}

function verifySecret(req: Request, body: AnyRecord): boolean {
  const headerOk = HEADER_NAME && EXPECTED_HEADER_VALUE &&
    (req.headers[HEADER_NAME.toLowerCase()] === EXPECTED_HEADER_VALUE);
  const bodySecret = (body as AnyRecord)?.sharedSecret;
  const bodyOk = SHARED_SECRET && typeof bodySecret === 'string' && bodySecret === SHARED_SECRET;
  return Boolean(headerOk || bodyOk);
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function buildDedupeKey(payload: AnyRecord, rawBody: string): string {
  const alertId = payload?.alertId || payload?.id;
  if (alertId && typeof alertId === 'string') return alertId;
  const sentAt = payload?.sentAt || payload?.occurredAt || '';
  return sha256(`${rawBody}|${sentAt}`);
}

function summarizeDetails(payload: AnyRecord): string | undefined {
  const alertType = payload?.alertType || 'alert';
  const device = payload?.deviceName || payload?.deviceSerial || payload?.deviceMac;
  const network = payload?.networkName || payload?.networkId;
  const text = payload?.text || payload?.description || payload?.summary;
  const parts = [alertType, device, network, text].filter(Boolean);
  const summary = parts.join(' • ');
  return summary || undefined;
}

function mapPayloadToEvent(payload: AnyRecord, dedupeKey: string): Prisma.EventUncheckedCreateInput {
  const occurredAt = toDate(payload?.occurredAt) || toDate(payload?.alertData?.occurredAt) || toDate(payload?.sentAt) || new Date();
  const imageUrl = payload?.imageUrl || payload?.alertData?.imageUrl || payload?.motionRecapImage || payload?.recapImageUrl;
  return {
    dedupeKey,
    occurredAt,
    alertType: String(payload?.alertType || 'unknown'),
    severity: payload?.severity ? String(payload.severity) : null,
    organizationId: payload?.organizationId ? String(payload.organizationId) : null,
    networkId: payload?.networkId ? String(payload.networkId) : null,
    deviceSerial: payload?.deviceSerial ? String(payload.deviceSerial) : null,
    deviceMac: payload?.deviceMac ? String(payload.deviceMac) : null,
    deviceName: payload?.deviceName ? String(payload.deviceName) : null,
    clientMac: payload?.clientMac ? String(payload.clientMac) : null,
    imageUrl: imageUrl ? String(imageUrl) : null,
    details: summarizeDetails(payload) || null,
    raw: (isSQLite ? JSON.stringify(payload) : (payload as any)) as any,
  };
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/webhooks/meraki', async (req: Request & { rawBody?: string }, res: Response) => {
  if (!isIpAllowed(req)) {
    return res.status(403).json({ error: 'Forbidden (IP not allowed)' });
  }
  if (req.headers['content-type'] !== 'application/json' && !String(req.headers['content-type'] || '').includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }
  const payload = req.body as AnyRecord;

  if (!verifySecret(req, payload)) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const rawBody = req.rawBody || JSON.stringify(payload);
  const dedupeKey = buildDedupeKey(payload, rawBody);
  const data = mapPayloadToEvent(payload, dedupeKey);

  try {
    const saved = await prisma.event.upsert({
      where: { dedupeKey },
      update: data,
      create: data,
    });
    // Fire-and-forget broadcast
    sendSseEvent(saved);
  } catch (err) {
    console.error('Upsert error', err);
  }
  // Always ack quickly
  return res.json({ ok: true });
});

app.get('/api/events', async (req, res) => {
  const qp = req.query as AnyRecord;
  const parseList = (name: string): string[] => {
    const v = qp[name] ?? qp[`${name}[]`];
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  };

  const alertTypes = parseList('alertType');
  const severities = parseList('severity');
  const networkId = qp.networkId ? String(qp.networkId) : undefined;
  const deviceSerial = qp.deviceSerial ? String(qp.deviceSerial) : undefined;
  const since = toDate(qp.since);
  const until = toDate(qp.until);
  const q = qp.q ? String(qp.q) : undefined;

  const where: Prisma.EventWhereInput = {};
  if (alertTypes.length) where.alertType = { in: alertTypes };
  if (severities.length) where.severity = { in: severities };
  if (networkId) where.networkId = { equals: networkId };
  if (deviceSerial) where.deviceSerial = { equals: deviceSerial };
  if (since || until) where.occurredAt = { gte: since ?? undefined, lte: until ?? undefined };
  if (q) {
    where.OR = [
      { details: { contains: q } as any },
      { deviceName: { contains: q } as any },
      { deviceSerial: { contains: q } as any },
      { networkId: { contains: q } as any },
      { alertType: { contains: q } as any },
    ];
  }

  const limit = Math.min(Math.max(parseInt(String(qp.limit || '50'), 10) || 50, 1), 200);
  const cursor = qp.cursor ? String(qp.cursor) : undefined;

  const orderBy: Prisma.EventOrderByWithRelationInput[] = [
    { occurredAt: 'desc' },
    { id: 'desc' },
  ];

  const items = await prisma.event.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const total = await prisma.event.count({ where });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop();
    nextCursor = next ? next.id : null;
  }

  return res.json({
    items,
    total,
    nextCursor,
  });
});

app.get('/api/events/:id', async (req, res) => {
  const id = req.params.id;
  const item = await prisma.event.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  return res.json(item);
});

app.get('/api/alert-types', async (_req, res) => {
  const rows = await prisma.event.findMany({
    distinct: ['alertType'],
    select: { alertType: true },
    orderBy: { alertType: 'asc' },
    take: 1000,
  });
  res.json({ items: rows.map((r) => r.alertType).filter(Boolean) });
});

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const id = sseIdSeq++;
  const client: SSEClient = { id, res };
  sseClients.set(id, client);
  const keepalive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 15000);
  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(id);
  });
});

// Simple in-memory image cache
type CacheEntry = { body: Buffer; contentType: string; ts: number };
const imageCache = new Map<string, CacheEntry>();
const IMAGE_TTL_MS = 5 * 60 * 1000;

app.get('/api/img', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid protocol');
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
  const now = Date.now();
  const hit = imageCache.get(url);
  if (hit && now - hit.ts < IMAGE_TTL_MS) {
    res.setHeader('Content-Type', hit.contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(hit.body);
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).json({ error: 'fetch failed' });
    const arrayBuf = await resp.arrayBuffer();
    const body = Buffer.from(arrayBuf);
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    imageCache.set(url, { body, contentType, ts: now });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(body);
  } catch (e) {
    return res.status(500).json({ error: 'proxy error' });
  }
});

app.post('/api/admin/seed', async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!ADMIN_TOKEN || auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const now = new Date();
  const samples: AnyRecord[] = [
    {
      alertType: 'MV Motion Recap',
      severity: 'Info',
      organizationId: 'org_1',
      networkId: 'N_123',
      deviceSerial: 'Q2GV-ABCD-1234',
      deviceName: 'Lobby Cam',
      clientMac: null,
      occurredAt: new Date(now.getTime() - 60_000).toISOString(),
      sentAt: now.toISOString(),
      sharedSecret: SHARED_SECRET,
      imageUrl: 'https://placehold.co/160x90/png',
      text: 'Motion recap available',
      alertId: 'sample-1'
    },
    {
      alertType: 'MX Offline',
      severity: 'Critical',
      organizationId: 'org_1',
      networkId: 'N_123',
      deviceSerial: 'Q2GV-WXYZ-9999',
      deviceName: 'Edge Security',
      occurredAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      sentAt: now.toISOString(),
      sharedSecret: SHARED_SECRET,
      text: 'Security appliance went offline',
      alertId: 'sample-2'
    }
  ];
  const created: EventModel[] = [];
  for (const s of samples) {
    const dedupeKey = buildDedupeKey(s, JSON.stringify(s));
    const data = mapPayloadToEvent(s, dedupeKey);
    const saved = await prisma.event.upsert({ where: { dedupeKey }, update: data, create: data });
    created.push(saved);
  }
  created.forEach(sendSseEvent);
  res.json({ inserted: created.length });
});

app.listen(PORT, () => {
  console.log(`Miles API listening on http://localhost:${PORT}`);
});


