# Miles — Meraki Webhook Receiver + Alerts UI

Miles is a Meraki-style dashboard and webhook receiver that ingests Cisco Meraki alerts in real time, verifies a shared secret, stores events, and displays a live, filterable alerts table with MV motion recap thumbnails.

## Monorepo

- packages/miles-api — Node 20 + TypeScript + Express, Prisma ORM
- packages/miles-web — React 18 + Vite + Tailwind + TanStack Table

## Quick start (local)

1) Install Node 20 and Docker

2) Install deps

```bash
npm install
```

3) Dev mode (API + Web):

```bash
npm run dev
```

The API runs on http://localhost:8080 and Web on http://localhost:5173

## Quick start (Docker)

```bash
docker compose up --build
```

This brings up Postgres, the API, and the Web UI.

## Environment

Set these variables (prefix MILES_). Header-based verification is optional.

```env
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/miles?schema=public
MILES_SHARED_SECRET=your_shared_secret
MILES_HEADER_NAME=
MILES_EXPECTED_HEADER_VALUE=
MILES_ADMIN_TOKEN=your_admin_token
MILES_WEBHOOK_IP_ALLOWLIST=1.2.3.4,5.6.7.8
```

The API also accepts MERAKI_* equivalents for convenience.

## Endpoints (API)

- POST /api/webhooks/meraki — receive Meraki webhooks, verify secret, upsert by dedupeKey
- GET /api/events — server-side filters: alertType[], severity[], networkId, deviceSerial, since, until, q, cursor, limit
- GET /api/events/:id — event with raw JSON
- GET /api/stream — Server-Sent Events for realtime updates
- GET /api/img?url=... — image proxy/cache for MV recap thumbnails
- POST /api/admin/seed — dev-only seeding (Bearer token)

## Meraki Dashboard setup

Network-wide → Alerts → Webhooks:

1. Add HTTPS receiver URL: `https://YOUR_API_HOST/api/webhooks/meraki`
2. Set Shared Secret to the value of `MILES_SHARED_SECRET`
3. (Optional) Templates with header verification: If your template places the secret in a header (e.g., `Authorization`), set `MILES_HEADER_NAME` and `MILES_EXPECTED_HEADER_VALUE` to match.
4. Click “Send test webhook” to send a test event and confirm a 200 OK.
5. Open Miles UI and verify the alert appears in the table. If not, check API logs and that your secret matches.

Recommended Meraki dashboard steps:

- Network-wide → Alerts → Webhooks → Add HTTP server
- Set Name to “Miles” and URL to your API receiver
- Set Shared Secret to your `MILES_SHARED_SECRET`
- Optionally choose a Payload Template that includes MV images (for motion recap thumbnails)
- Save and Send test webhook

## Deploy

### Vercel (Web UI)

1. Push this repo to GitHub and import the repo into Vercel as a project targeting `packages/miles-web`.
2. Framework: Vite; Root Directory: `packages/miles-web`.
3. Set Environment Variables:
   - `VITE_API_BASE_URL` = `https://YOUR_API_HOST` (where the API is hosted)
4. Deploy. The UI will call the API at `/api/*` on your API host.

### API Hosting

Vercel serverless is not ideal for SSE. Deploy the API to a host that supports long-lived connections:

- Render: Node service, `packages/miles-api`. Set env vars and a Postgres database.
- Fly.io / Heroku: Node app with Dockerfile in `packages/miles-api`.

Required env vars:

- `PORT` (e.g., 8080)
- `DATABASE_URL` (Postgres URL in prod; SQLite in dev only)
- `MILES_SHARED_SECRET`
- `MILES_ADMIN_TOKEN`
- Optional: `MILES_HEADER_NAME`, `MILES_EXPECTED_HEADER_VALUE`, `MILES_WEBHOOK_IP_ALLOWLIST`

After deploy, verify `/healthz` returns `{ ok: true }` and `/api/stream` streams events.

## Acceptance

- Name and UI brand as Miles
- Secure secret verification with optional header-based verification
- Live, filterable alerts table with MV thumbnails and lightbox
- Paginated API with server-side filters; URL-synced filters in UI
- Idempotent inserts; fast 200 acks; basic admin auth
- One-command local run and clear deployment docs

