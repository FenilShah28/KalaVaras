# कलावारस — KalaVaras

**Folk Art Motor Memory Platform** — preserving invisible embodied knowledge of traditional Indian brush movements.

Captures the motor memory of master artisans in Warli, Kolam, Pichwai, and Madhubani traditions and transfers that knowledge to apprentices through slit-scan video analysis and structured practice.

---

## Architecture

```
d:/FENIL/PROJECT 1/
├── apps/
│   ├── web/          # React 18 PWA (Vite + Tailwind + i18next)
│   └── api/          # Node.js 20 + Express 5 + Drizzle/PostgreSQL
├── services/
│   └── slit-scan/    # Python 3.11 + Flask + FFmpeg + Pillow
├── docker-compose.yml
├── Makefile
└── .env.example
```

**Stack:**
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v3, Zustand, i18next (Marathi default) |
| Backend | Express 5, TypeScript, Drizzle ORM, PostgreSQL 15 |
| Job Queue | BullMQ + Redis 7 |
| Media | Cloudflare R2 (S3-compatible) |
| Video Processing | Python 3.11, FFmpeg, Pillow |
| Auth | JWT (access in-memory, refresh in httpOnly cookie) |
| Email | Resend |
| WebSocket | Socket.IO (real-time processing status) |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL, Redis, slit-scan service)
- Python 3.11+ (optional — service runs in Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd kalavaras
cp .env.example .env
# Edit .env with your actual credentials
```

### 2. Install dependencies

```bash
make setup
```

### 3. Start infrastructure

```bash
make infra
# Starts PostgreSQL (5432), Redis (6379), slit-scan service (5000)
```

### 4. Run migrations

```bash
make migrate
```

### 5. Start development servers

```bash
make dev
# API → http://localhost:4000
# Web → http://localhost:5173
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

See [.env.example](.env.example) for full documentation of each variable.

> **Security**: Never commit `.env`. It is gitignored. Use `.env.example` as the reference.

---

## Available Commands

| Command | Description |
|---|---|
| `make setup` | Install all npm dependencies |
| `make infra` | Start Docker services (PostgreSQL, Redis, slit-scan) |
| `make dev` | Start API + web dev servers |
| `make migrate` | Run Drizzle DB migrations |
| `make build` | Production build (API + web) |
| `make test` | Run API tests |
| `make typecheck` | TypeScript type check (both packages) |
| `make audit` | npm security audit |
| `make stop` | Stop Docker services |
| `make clean` | Remove build artifacts + node_modules |

---

## Security Design

- **Secrets**: All in `.env` — Zod validates at startup, server refuses to start if missing
- **JWT**: Access tokens in Zustand memory (never localStorage), refresh tokens in `httpOnly; Secure; SameSite=Strict` cookies
- **IDOR prevention**: Every data-access operation follows the **fetch-then-check pattern**:
  1. Fetch resource by ID
  2. Compare `ownerId` to `req.user.id`
  3. If mismatch: return 404 (not 403 — avoids information disclosure)
  4. Log IDOR attempt to `audit_log` table
- **CORS**: Whitelist `FRONTEND_URL` only — never `origin: *`
- **Rate limiting**: Redis-backed in production (5 req/min auth, 100 req/min read)
- **EXIF stripping**: All uploaded images stripped via `sharp` before R2 storage
- **File uploads**: UUID filenames, MIME whitelist, 5MB limit, memory-only multer storage
- **SQL injection**: Drizzle ORM parameterized queries — no raw SQL interpolation
- **XSS**: No `dangerouslySetInnerHTML`, no `eval()`, React renders text safely
- **Internal service auth**: `X-Internal-Secret` header with constant-time comparison (`hmac.compare_digest`)

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Register new user |
| POST | `/api/v1/auth/login` | — | Login (returns access token + sets refresh cookie) |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/v1/auth/logout` | JWT | Logout (clears cookie) |
| GET  | `/api/v1/auth/me` | JWT | Current user info |
| GET  | `/api/v1/cards` | JWT | List stroke cards |
| POST | `/api/v1/cards` | JWT | Create card (artisan/admin) |
| GET  | `/api/v1/cards/:id` | JWT | Get card |
| PATCH| `/api/v1/cards/:id` | JWT | Update card (owner/admin) |
| DELETE | `/api/v1/cards/:id` | JWT | Delete card (owner/admin) |
| POST | `/api/v1/cards/:id/publish` | JWT | Publish card |
| POST | `/api/v1/media` | JWT | Upload media file |
| GET  | `/api/v1/media/card/:cardId` | JWT | Get media for card |
| DELETE | `/api/v1/media/:id` | JWT | Delete media asset |
| POST | `/api/v1/practice` | JWT | Submit practice session |
| GET  | `/api/v1/practice` | JWT | List practice sessions |
| GET  | `/api/v1/practice/dashboard` | JWT | Progress dashboard |
| POST | `/api/v1/sync` | JWT | Batch offline sync |
| GET  | `/health` | — | Health check |

---

## Slit-Scan Pipeline

When an artisan uploads a source video:
1. **Upload** → multer receives buffer, EXIF stripped (images only), UUID filename generated, uploaded to R2
2. **Enqueue** → BullMQ job created with `assetId`, `storageKey`
3. **Worker** → marks asset `processing`, calls Python slit-scan service
4. **Python** → FFmpeg extracts frames → Pillow samples centre column from each → composites horizontal strip
5. **Waveform** → per-frame luminance delta plotted as sparkline PNG
6. **Upload** → both outputs uploaded to R2 as `processed/<cardId>/<assetId>_slit.png` and `_wave.png`
7. **Complete** → DB records inserted for derived assets, source asset marked `complete`
8. **WebSocket** → `processing:status` event pushed to `user:<userId>` room at 10%, 70%, 100%

---

## Folder Structure

```
apps/api/src/
├── config/         env.ts, database.ts, redis.ts, cors.ts, r2.ts, queue.ts, socket.ts
├── db/schema/      users, strokeCards, mediaAssets, practiceSessions, syncQueue, auditLog
├── middleware/     helmet, rateLimiter, auth, ownership, validation, requestId, errorHandler, hpp
├── routes/         auth, cards, media, practice, sync
├── services/       auth, cards, media, practice, sync, email
├── workers/        slitScan.worker.ts
└── utils/          logger, apiResponse, errors

apps/web/src/
├── components/     Button, Input, Navbar
├── hooks/          useAuth
├── i18n/           mr.json (Marathi), en.json (English)
├── pages/          Home, Login, Register, Library, Practice, Progress, Artisan
├── store/          authStore (Zustand, in-memory JWT)
└── utils/          api (typed fetch client), socket, logger

services/slit-scan/
├── main.py         Flask API (auth, validation, error handling)
├── processor.py    FFmpeg + Pillow pipeline + R2 upload
├── requirements.txt
└── Dockerfile      Non-root, Gunicorn 4-worker
```

---

## License

© 2025 KalaVaras. All rights reserved.
