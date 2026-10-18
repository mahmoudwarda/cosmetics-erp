# لمسة جمال | Cosmetics Store ERP

Local-first inventory and shop operations app built with Next.js 16, React 19, TypeScript, PostgreSQL and Drizzle ORM. The app listens on `0.0.0.0` so other devices on the shop LAN can connect.

## Architecture

- `src/app`: App Router pages and local API routes.
- `src/features`: feature actions and UI entry points.
- `src/server/db/schema.ts`: normalized schema; money uses PostgreSQL `numeric`, quantities use decimal `numeric`.
- `src/server/services`: transaction and ledger business logic.
- `drizzle/`: generated PostgreSQL migrations.
- `scripts/`: migration and demo seed.

Ledgers hold stock movements, cash transactions, party account entries and audit events. Invoice creation uses a PostgreSQL transaction; transaction-scoped advisory locks serialize invoice numbering. Sales check and deduct stock atomically. Purchases add stock and update item cost atomically. Sensitive server actions must verify permissions.

## Install and run

Install Node.js 20.9+ on the host PC. PostgreSQL can run via Docker or a normal Windows installation. A portable PostgreSQL 17.11 x64 binary bundle is also staged locally under `work/postgresql-portable/pgsql`; `start-windows.bat` starts its local database cluster under `data/pgdata`, applies migrations and launches the app. It binds PostgreSQL only to `127.0.0.1:55432`; the Next.js app listens on `0.0.0.0:3001` for shop LAN access. The PostgreSQL binaries are from the Windows binaries archive linked by the [official PostgreSQL Windows downloads page](https://www.postgresql.org/download/windows/).

Copy `.env.example` to `.env` and set a unique `AUTH_SECRET` and database URL. Install dependencies with `npm install`. For a fully disconnected setup on another machine, stage the npm cache and the PostgreSQL bundle locally first; runtime needs no internet once these are in place. No CDN, remote fonts, APIs, analytics or telemetry are used. Licensed Cairo/Tajawal font binaries were not supplied, so the current UI uses local system Arabic fonts; place fonts under `public/fonts` and wire with `next/font/local` when available.

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Seed login: `admin` / `ChangeMe123!`. Change immediately and use `SEED_ADMIN_PASSWORD` before seeding a production database. For production run `npm run build` then `npm run start`. `start-windows.bat` applies migrations and restarts after process exit; use Windows Task Scheduler to run it at startup. Configure Windows Defender Firewall for inbound TCP port 3001. Other LAN devices can open `http://<host-LAN-IP>:3001`.

## Database, backups and printing

Edit `src/server/db/schema.ts`, run `npm run db:generate`, then `npm run db:migrate`. Seed adds sample products, an admin role with every grant and a main cashbox. Backups can use local `pg_dump`; set `BACKUP_DIR` to a local drive/USB and `BACKUP_RETENTION` to the number of recent dumps. Restore with `pg_restore --clean --if-exists -d <database> <dump-file>` after stopping the app and taking a safety copy. Browser native print is available for printable pages; customize print CSS for invoice documents. Logo and product uploads should be stored locally under `UPLOADS_DIR`.

## Permissions

Inventory, invoices, finance, parties, users, settings and reports each have `view`, `create`, `edit`, `delete` and `export` grants. Seeded `super-admin` receives all grants. Every future server action must call `requirePermission(module, action)`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` after installing dependencies and setting up PostgreSQL. Exercise accounting workflows against a disposable database before shop use.
