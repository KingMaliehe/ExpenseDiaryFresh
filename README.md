# Expense Diary SA

A personal expense-tracking app for South Africa. React Native (Expo) client
backed by a self-owned Express + Prisma + PostgreSQL API.

Originally built on Supabase; the data and auth layer has since been replaced
by a custom backend (`backend/`) for full control over auth, data, and hosting.

## Stack

| Layer      | Tech                                                             |
| ---------- | --------------------------------------------------------------- |
| App        | Expo (React Native), expo-router, Zustand, TypeScript           |
| Backend    | Express, Prisma, PostgreSQL, JWT (access + refresh), Zod        |
| Auth       | Email/password, refresh-token rotation, OTP password reset      |
| Email      | Resend (OTP delivery; logs to console in dev if no key)         |
| Deploy     | Docker Compose + Caddy (auto HTTPS) — see `backend/DEPLOY.md`   |

## Repo layout

```
app/            Expo Router screens (auth flow + tabs)
src/
  services/     apiClient (HTTP), tokenStore, notifications, offlineSync
  store/        Zustand stores (auth, transactions, budgets)
  theme/        design tokens
backend/
  src/          Express app, routes, middleware, libs
  prisma/       schema + migrations
  deploy/       docker-compose, Caddyfile, backup script
```

## Prerequisites

- Node.js ≥ 20
- Docker Desktop (for a local Postgres) — or any local PostgreSQL 16
- Expo Go on your phone, or a browser / emulator for the web build

## Running locally

### 1. Database

Start a local Postgres (matches the default `DATABASE_URL`):

```bash
docker run -d --name expensediary-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=expensediary postgres:16
```

Manage it later with `docker stop|start expensediary-pg`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT secrets, (optional) Resend key
npm install
npx prisma migrate deploy # create tables
npm run dev               # http://localhost:4000
```

Health check: `curl http://localhost:4000/health` → `{"ok":true,"db":"ok",...}`

### 3. App

In the repo root, set the API URL the client should hit:

```bash
# .env
EXPO_PUBLIC_API_URL=http://localhost:4000   # web / emulator
# For a physical phone, use your machine's LAN IP instead of localhost,
# e.g. http://192.168.x.x:4000 (find it with `ipconfig`). Same WiFi required.
```

Then:

```bash
npm install
npx expo start -c   # -c clears cache so .env changes are picked up
```

Press `w` (web), `a` (Android), or `i` (iOS), or scan the QR with Expo Go.

> **Note:** the client stores JWTs in `expo-secure-store` on native and falls
> back to `localStorage` on web (SecureStore has no web implementation).

## Environment variables

**Backend (`backend/.env`)** — see `backend/.env.example`:
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`,
`JWT_REFRESH_TTL`, `RESEND_API_KEY`, `RESEND_FROM`, `PORT`, `NODE_ENV`,
`CORS_ORIGIN`.

**App (root `.env`)**: `EXPO_PUBLIC_API_URL`.

All `.env` files are gitignored — only the `.env.example` templates are tracked.

## Deployment

Self-host the whole stack (Postgres + API + Caddy for automatic HTTPS) on a
single VM. Full walkthrough in [`backend/DEPLOY.md`](backend/DEPLOY.md).

## API overview

Base URL `EXPO_PUBLIC_API_URL`. All non-auth routes require an
`Authorization: Bearer <accessToken>` header.

- `POST /auth/signup` · `POST /auth/signin` · `POST /auth/refresh` · `POST /auth/signout` · `GET /auth/me`
- `POST /auth/forgot-password` · `POST /auth/verify-otp` · `POST /auth/reset-password`
- `GET/PATCH /profile`
- `GET/POST/PATCH/DELETE /categories`
- `GET/POST/PATCH/DELETE /transactions` · `POST /transactions/bulk`
- `GET/POST/PATCH/DELETE /budgets`
- `GET /summary/monthly` · `GET /summary/categories`
