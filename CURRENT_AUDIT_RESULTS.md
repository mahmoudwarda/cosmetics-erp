# Current Audit Results

**Audit date:** 2026-10-19  
**Scope:** Application routes, authentication, data integrity, migrations, backup/restore, and Windows/Docker startup configuration.

## Verification performed

- npm run typecheck: passed.
- npm run lint: passed with 0 errors and 44 existing warnings.
- npm run build: production build passed; all 17 App Router routes were listed by Next.js.
- npm test -- --reporter=dot: 27 tests passed in 2 files, including stock/cash concurrency and login throttling.
- Applied migrations to a newly created, isolated PostgreSQL test database.
- Ran the seed twice on a fresh test database: one admin, one role, 35 grants, one base unit, one settings row, and no sample products or cashboxes.
- Signed in through the browser and loaded /, /inventory, /invoices, /invoices/new, /finance, /parties, /reports, /users, /settings, and /statements without an application error. Browser console showed no errors or warnings during the route check.
- Exercised the backup endpoint: an authenticated test request returned HTTP 200 and produced a PostgreSQL custom-format dump; an unauthenticated request returned HTTP 401.
- Restored the dump to a second isolated database. pg_restore completed successfully; the restored database contained 16 public tables and 2 test users.
- Checked invalid upload paths; the upload handler returned 404 and did not expose local files.

All database tests used temporary databases named cosmetics_erp_test, cosmetics_erp_restore_test, and cosmetics_erp_install_test on a temporary local PostgreSQL cluster. The business database and data/pgdata were not used or modified.

The temporary PostgreSQL server is stopped. Automated removal of three generated audit directories under the ignored work folder was rejected by the filesystem sandbox; those folders contain only isolated test databases and test backup files, not customer data.

## Fixes included

- Added persistent, atomic login throttling per username and, when a trusted proxy is configured, per client address. Added a dummy Argon2 verification path to reduce username timing leaks.
- Removed the known fallback signing key. Production now requires a unique AUTH_SECRET of at least 32 characters.
- Added the login_attempts migration.
- Fixed the Windows PostgreSQL port mismatch: local launch scripts now use port 55432, matching .env.example.
- Made Docker migration failures stop startup instead of allowing the app to run against an outdated schema.
- Removed the known default admin password. First-time seeding now requires SEED_ADMIN_PASSWORD (at least 14 characters).
- Made seeding safe to repeat and removed fabricated demo stock and opening cash from new installations.
- Made Docker require explicit database/auth/cookie settings; documented when HTTPS and trusted-proxy settings are needed.
- Fixed decimal invoice discounts and strengthened atomic inventory/cash operations and backup-file handling.

## Conditions before customer deployment

- Use HTTPS for traffic outside a trusted local shop network and set SESSION_COOKIE_SECURE=true. The supplied Compose file does not terminate TLS; put a reverse proxy with a certificate in front of it. Set TRUST_PROXY=true only when that proxy overwrites forwarding headers.
- Set unique production values for AUTH_SECRET, POSTGRES_PASSWORD, and the initial SEED_ADMIN_PASSWORD; do not deploy the example placeholders.
- Existing Docker volumes retain the PostgreSQL password they were initialized with. Coordinate any credential rotation with the running database before changing its Compose value.
- The 44 ESLint warnings are non-blocking but should be cleaned up. Docker Compose itself and access from a second physical device were not exercised in this environment.
- The tests verify backup creation and restore to a separate test database; a scheduled off-device backup and disaster-recovery exercise remain deployment operations.

## Historical audit documents

DEFECT_REGISTER.md, FUNCTIONAL_TEST_MATRIX.md, ROUTE_FEATURE_MATRIX.md, and 06_security_and_reliability.md contain findings from an earlier code state. Their status is historical; this document records the current verification.
