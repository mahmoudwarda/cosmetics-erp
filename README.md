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

### Windows customer installer

Run `build-setup.bat` on the development PC to build `dist-installer\Cosmetics-ERP-Setup.exe`. The build PC needs Node.js and Inno Setup 6, plus the portable PostgreSQL runtime under `work\postgresql-portable\pgsql`. The installer contains the compiled standalone app and runtime files, not the source tree, local `.env`, or development database. Install it once on the shop's host PC; other shop devices use that PC's LAN address on port 3001. The first launch creates a local PostgreSQL cluster, generates its database and session secrets, and asks for the administrator password. Keep regular database backups before upgrading or uninstalling.

The installer configures one central host, but it is not a hardware-bound license: someone who has the installer can install another independent copy elsewhere. A strict one-device license would require a separate activation/signing process.

Install Node.js 20.9+ on the host PC. PostgreSQL can run via Docker or a normal Windows installation. A portable PostgreSQL 17.11 x64 binary bundle is also staged locally under `work/postgresql-portable/pgsql`; `start-windows.bat` starts its local database cluster under `data/pgdata`, applies migrations and launches the app. It binds PostgreSQL only to `127.0.0.1:55432`; the Next.js app listens on `0.0.0.0:3001` for shop LAN access. The PostgreSQL binaries are from the Windows binaries archive linked by the [official PostgreSQL Windows downloads page](https://www.postgresql.org/download/windows/).

Copy .env.example to .env and set a unique AUTH_SECRET, database URL, and a unique SEED_ADMIN_PASSWORD of at least 14 characters before the first seed. The seed creates no demo products, cash transactions, or opening balances. Install dependencies with npm install. For a fully disconnected setup on another machine, stage the npm cache and the PostgreSQL bundle locally first; runtime needs no internet once these are in place. No CDN, remote fonts, APIs, analytics or telemetry are used. Licensed Cairo/Tajawal font binaries were not supplied, so the current UI uses local system Arabic fonts; place fonts under public/fonts and wire with next/font/local when available.

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The initial username is admin; its password is the SEED_ADMIN_PASSWORD value. For production run npm run build then npm run start. start-windows.bat applies migrations and starts the app; use Windows Task Scheduler to run it at startup. Configure Windows Defender Firewall for inbound TCP port 3001, and keep PostgreSQL bound to localhost. Other LAN devices can open http://<host-LAN-IP>:3001 on a trusted shop network.

For Docker, set a unique URL-safe POSTGRES_PASSWORD and AUTH_SECRET in .env. Set SESSION_COOKIE_SECURE=true only when HTTPS terminates in front of the app; use false only for a trusted LAN over HTTP. Set TRUST_PROXY=true only behind a reverse proxy that overwrites X-Real-IP/X-Forwarded-For. Existing Docker database volumes keep their initialized PostgreSQL password; coordinate any password rotation with the database before changing the compose environment.

## Database, backups and printing

Edit `src/server/db/schema.ts`, run `npm run db:generate`, then `npm run db:migrate`. The seed creates the admin role and permissions, the initial admin account, a base unit, and settings; it does not create sample financial or stock records. Backups can use local `pg_dump`; set `BACKUP_DIR` to a local drive/USB and `BACKUP_RETENTION` to the number of recent dumps. Restore with `pg_restore --clean --if-exists -d <database> <dump-file>` after stopping the app and taking a safety copy. Browser native print is available for printable pages; customize print CSS for invoice documents. Logo and product uploads should be stored locally under `UPLOADS_DIR`.

## Permissions

Inventory, invoices, finance, parties, users, settings and reports each have `view`, `create`, `edit`, `delete` and `export` grants. Seeded `super-admin` receives all grants. Every future server action must call `requirePermission(module, action)`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` after installing dependencies and setting up PostgreSQL. Exercise accounting workflows against a disposable database before shop use.
