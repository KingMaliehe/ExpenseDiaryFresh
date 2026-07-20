# Deploying to Railway

One-time setup, ~10 minutes. The repo must be on GitHub first.

## 1. Create the project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. In the service settings, set **Root Directory** to `backend`. Railway reads `railway.json` for the build/start commands and `/health` healthcheck automatically.

## 2. Add Postgres

In the project canvas: **+ New** → **Database** → **PostgreSQL**.

## 3. Environment variables

On the backend service → **Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `JWT_ACCESS_SECRET` | generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | generate another one (must differ) |
| `JWT_ACCESS_TTL` | `900` |
| `JWT_REFRESH_TTL` | `2592000` |
| `RESEND_API_KEY` | your real key from resend.com (otherwise OTP emails only log to console) |
| `RESEND_FROM` | `Expense Diary <onboarding@resend.dev>` (or your verified domain) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `*` (mobile apps don't send an Origin; tighten if you add a web build) |

`PORT` is injected by Railway automatically.

## 4. Get the URL

Service → **Settings** → **Networking** → **Generate Domain**. You'll get something like `https://expense-diary-backend-production.up.railway.app`.

Check it: `https://<domain>/health` should return `{"ok":true,"db":"ok",...}`.
The first deploy also runs `prisma migrate deploy`, which creates all tables.

## 5. Point the app at it

In the repo root `.env`:

```
EXPO_PUBLIC_API_URL=https://<your-domain>.up.railway.app
```

For EAS builds, set it there too (env vars are baked in at build time):

```
eas env:create --name EXPO_PUBLIC_API_URL --value https://<your-domain>.up.railway.app
```

Then rebuild / publish an OTA update.
