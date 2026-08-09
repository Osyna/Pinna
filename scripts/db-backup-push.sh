#!/usr/bin/env bash
# Dump the Pinna DB and push the snapshot to the PRIVATE off-site repo
# (github.com/Osyna/pinna-db-backups). Intended for cron:
#   0 3 * * * /home/irvin/Projects/Pinna/scripts/db-backup-push.sh >> /home/irvin/Backups/pinna/cron.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/db-backup.sh

DEST="$HOME/Backups/pinna"
mkdir -p "$DEST"
cp backups/pinna-*.sql.gz "$DEST"/ 2>/dev/null || true

cd "$DEST"
# keep the 60 newest off-site
ls -1t pinna-*.sql.gz 2>/dev/null | tail -n +61 | xargs -r rm --
git add -A
git -c user.name=pinna-backup -c user.email=7606712+Osyna@users.noreply.github.com \
  commit -q -m "DB backup $(date +%F-%H%M)" || exit 0   # nothing new
git push -q origin main
echo "$(date -Is) backup pushed"
