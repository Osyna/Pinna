#!/usr/bin/env bash
# pg_dump backup for the Pinna database.
#
#   ./scripts/db-backup.sh            # uses DATABASE_URL from .env.local
#   ./scripts/db-backup.sh .env       # or another env file
#
# Writes gzip'd dumps to ./backups/pinna-YYYYmmdd-HHMMSS.sql.gz and keeps
# the 30 most recent. Run it from cron/CI for scheduled protection, e.g.:
#   0 3 * * * cd /path/to/Pinna && ./scripts/db-backup.sh >> backups/cron.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${1:-.env.local}"
[ -f "$ENV_FILE" ] || { echo "env file $ENV_FILE not found"; exit 1; }
DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL missing in $ENV_FILE"; exit 1; }

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/pinna-$STAMP.sql.gz"

if command -v pg_dump > /dev/null; then
  pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$OUT"
else
  # fall back to a dockerized pg_dump matching the server major version
  docker run --rm postgres:18-alpine pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$OUT"
fi

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t backups/pinna-*.sql.gz | tail -n +31 | xargs -r rm --
