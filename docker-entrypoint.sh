#!/bin/sh
# Container startup: reverse proxy + API server.
#
# We deliberately do NOT chain these with `&&`. A failure while syncing the
# database schema must not prevent the Node server from starting — otherwise
# nginx has no upstream and every /api request returns 502. If the schema
# push fails (e.g. the database is temporarily unreachable), we log it and
# still start the server so it can serve requests and surface real errors.

set -e

# Start nginx (runs in the background as a daemon).
nginx

# Apply committed migrations (reviewable history). Fall back to a schema
# push for databases that predate the migration baseline, and never abort
# startup if the database is temporarily unreachable.
if ! npx prisma migrate deploy; then
  echo "WARN: 'prisma migrate deploy' failed; trying 'prisma db push' fallback."
  if ! npx prisma db push --skip-generate; then
    echo "WARN: schema sync failed; starting server anyway. Check DATABASE_URL."
  fi
fi

# Start the API server in the foreground (keeps the container alive).
exec node server/index.js
