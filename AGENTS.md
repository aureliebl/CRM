# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single Next.js app (`admin-costockage`): admin panel built with Next.js 16 (Turbopack), React, TypeScript. Runtime storage is **PostgreSQL-only** (BigQuery is used only for analytics connectors). There is also an optional CRDT collab WebSocket server in `collab-server/` used by the Documentation feature.

Standard scripts live in `package.json` (`dev`, `build`, `lint`, `docs:collab:dev`). Full feature/setup docs are in `README.md`. Only non-obvious startup caveats are captured below.

### Local services / startup

- **PostgreSQL** is installed in the VM but its daemon does NOT auto-start on boot. Start it before running the app:
  - `sudo pg_ctlcluster 16 main start`
  - Local DB is `costotest`, owned by role `costo` / password `costo`. Connection string: `postgres://costo:costo@localhost:5432/costotest`.
- **Env file:** `.env.local` (gitignored) holds `DATABASE_URL`, `DEMO_AUTH=true`, and generated secrets (`APP_SESSION_SECRET`, `VAULT_MASTER_KEY`, `DOCS_CRDT_SECRET`). The app throws at import time if `DATABASE_URL` is unset, so `.env.local` must exist. If it is missing, recreate it from `.env.example` pointing at the local DB above.
- **Next dev server:** `npm run dev` (http://localhost:3000). It auto-loads `.env.local`.
- **Collab server (optional, only for Documentation realtime):** `npm run docs:collab:dev` (ws://localhost:1234). It does NOT read `.env.local` automatically — export env first, e.g. `set -a; source .env.local; set +a; npm run docs:collab:dev`. Not required for login/dashboard/tickets/vault.

### Database migrations

- Account/log/credential/reset tables are auto-created by the app on first query (`ensurePostgresSchema` in `src/lib/account-store.ts`).
- All other feature tables (connectors, tabs, security, dashboard, vault, tickets, documentation, invitations) require applying the SQL files in `data/migrations/*.sql` in order. To (re)apply against a fresh DB:
  - `for f in data/migrations/*.sql; do PGPASSWORD=costo psql -h localhost -U costo -d costotest -f "$f"; done`
  - Migrations are idempotent (`IF NOT EXISTS`), so re-running is safe.

### Login / test account

- The app redirects to `/login`. With `DEMO_AUTH=true`, any seeded account logs in with password `demo123`.
- Seeded super-admin account: `theo@costockage.fr` / `demo123` (see `src/lib/server-seed.ts`). The README also mentions `paul.sales@…` / `camille.support@…` but those are NOT seeded locally.

### Notes

- `npm run lint` currently reports pre-existing lint errors/warnings in the codebase; the lint tooling itself works. Do not treat these as environment breakage.
- `.npmrc` sets `legacy-peer-deps=true`; use `npm` (a `package-lock.json` is committed).
