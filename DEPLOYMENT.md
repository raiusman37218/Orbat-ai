# Orbat AI — Production Deployment & Operations Guide

This guide details the complete deployment process for **Orbat AI** on **Hetzner Cloud VPS** managed via **Coolify** or standard **Docker Compose**, running completely independently without Supabase.

---

## 1. System Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │                 Reverse Proxy                 │
                  │             (Traefik / Coolify)               │
                  └──────────────┬─────────────────┬──────────────┘
                                 │                 │
                https://api.yourdomain.com         wss://api.yourdomain.com/realtime
                                 │                 │
                                 ▼                 ▼
                  ┌───────────────────────────────────────────────┐
                  │          Orbat AI NestJS Backend              │
                  │   - REST API (Port 4000)                      │
                  │   - Socket.IO Gateway (/realtime)             │
                  │   - Native JWT Auth + Multi-tenant Guards     │
                  │   - RAG & AI Engine                           │
                  └──────────────┬───────────────┬────────────────┘
                                 │               │
                 Database Queries│               │BullMQ Events & Sockets
                                 ▼               ▼
        ┌─────────────────────────────┐   ┌─────────────────────────────┐
        │     PostgreSQL Database     │   │      Redis 7 Container      │
        │   (Neon.tech Cloud DB)      │   │  - Socket.IO Redis Adapter  │
        │   - PostgreSQL 18 + pgvector│   │  - BullMQ Job Queues        │
        │   - 70+ Normalized Tables   │   │  - Presence & Rate Limiting │
        └─────────────────────────────┘   └──────────────┬──────────────┘
                                                         │
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │   BullMQ Background Worker  │
                                          │   - AI Response Generation  │
                                          │   - Email & Push Notifs     │
                                          │   - SLA & Macro Automations │
                                          │   - Webhook Dispatches      │
                                          └─────────────────────────────┘
                                                         │
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │    Cloudflare R2 Storage    │
                                          │    - S3-compatible API      │
                                          │    - Presigned Upload/DL    │
                                          │    - Private attachments    │
                                          └─────────────────────────────┘
```

---

## 2. Environment Variables Configuration

Create a `.env` file for production deployment:

```env
# ----------------------------------------------------------------
# Application
# ----------------------------------------------------------------
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://app.yourdomain.com,https://yourdomain.com

# ----------------------------------------------------------------
# Database (Neon PostgreSQL with pgvector)
# ----------------------------------------------------------------
DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@<HOST>/neondb?sslmode=require
DATABASE_SSL=true
DATABASE_MAX_POOL_SIZE=25

# ----------------------------------------------------------------
# Authentication (Native JWT)
# ----------------------------------------------------------------
JWT_SECRET=super_secret_production_key_minimum_32_characters_long_1234
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=super_secret_refresh_key_minimum_32_characters_long_5678
JWT_REFRESH_EXPIRES_IN=30d

# ----------------------------------------------------------------
# Redis (Socket.IO Adapter & BullMQ Queues)
# ----------------------------------------------------------------
REDIS_PASSWORD=orbat_production_redis_password_secure_99
REDIS_URL=redis://:orbat_production_redis_password_secure_99@redis:6379

# ----------------------------------------------------------------
# Object Storage (Cloudflare R2 - S3 Compatible)
# ----------------------------------------------------------------
CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=orbat-chat-uploads
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.yourdomain.com

# ----------------------------------------------------------------
# AI Engine Providers
# ----------------------------------------------------------------
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 3. Database Migration & Initialization

Before starting the application, run the automated migration suite against your Neon PostgreSQL instance:

```bash
cd backend
npm run migrate
```

This reconciles all 83 schema migrations, enables `vector`, `uuid-ossp`, and `pgcrypto` extensions, bootstraps missing columns, and ensures indexes are applied.

---

## 4. Deployment via Docker Compose

Run the production stack on any Ubuntu 22.04 / 24.04 VPS (Hetzner CPX21 or CPX31 recommended):

```bash
# 1. Clone repository
git clone https://github.com/your-org/orbat-ai.git /opt/orbat
cd /opt/orbat

# 2. Configure production environment
cp backend/.env.example backend/.env
# (Populate your Neon DB URL and Cloudflare credentials)

# 3. Launch stack
docker compose -f docker-compose.prod.yml up -d --build
```

To verify container health:
```bash
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Deployment via Coolify

1. **Create Project**: Open your Coolify dashboard and create a new project called `Orbat AI`.
2. **Add Resource**: Choose **Docker Compose** or **Application**.
3. **Source**: Select your Git repository.
4. **Configuration**:
   - Set **Docker Compose Location**: `docker-compose.prod.yml`
   - Paste environment variables in the Coolify **Environment Variables** tab.
5. **Domains**:
   - `api` service: Assign `api.yourdomain.com`
6. **Deploy**: Click **Deploy**. Coolify handles SSL certificates (Let's Encrypt), container health monitoring, and zero-downtime rolling deploys automatically.

---

## 6. Verification & Health Endpoints

- **Liveness probe**: `GET /api/v1/health/live` (Returns HTTP 200 `{ status: "ok" }`)
- **Readiness probe**: `GET /api/v1/health/ready` (Verifies PostgreSQL connection pool)
- **Aggregated Health**: `GET /api/v1/health`
- **Swagger Documentation**: `GET /docs`
- **WebSocket Gateway**: Connect via Socket.IO client to `wss://api.yourdomain.com/realtime`

