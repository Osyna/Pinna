# Database backups

**There were no backups before Feb 2026 — set this up now.**

## Quick local backup

```bash
./scripts/db-backup.sh            # dumps to ./backups/*.sql.gz (gitignored)
```

Restore:

```bash
gunzip -c backups/pinna-XXXX.sql.gz | psql "$DATABASE_URL"
```

## Scheduled backups (choose at least one)

1. **Cron on any machine that can reach the DB** (e.g. your workstation or the server):
   `0 3 * * * cd /path/to/Pinna && ./scripts/db-backup.sh >> backups/cron.log 2>&1`
2. **Dokploy scheduled backups**: Dokploy → Settings → S3 Destinations → add a bucket
   (any S3-compatible: Backblaze B2, Scaleway, MinIO…), then Mapsly → database →
   Backups → schedule daily. This is the recommended permanent setup.
3. **Host snapshots**: if the VPS provider supports scheduled snapshots, enable them
   as a second layer.

## Safety rules for this repo

- `./start` **never** pushes schema; deploys run committed migrations only.
- Never point `prisma migrate diff/dev --shadow-database-url` at a real database —
  Prisma **resets** shadow databases. Use a throwaway local container instead.
- Take a manual backup before any schema change: `./scripts/db-backup.sh`.
