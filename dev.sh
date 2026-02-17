#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm install
fi

# Generate Prisma client if needed
if [ ! -d node_modules/.prisma/client ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

# Check for .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and set your DATABASE_URL."
  exit 1
fi

# Sync database schema (creates tables if they don't exist)
echo "Syncing database schema..."
npx prisma db push --skip-generate

SESSION="pinna"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with Backend in the first pane (Top)
tmux new-session -d -s "$SESSION" -n dev "npm run dev:server"

# Split vertically and run Frontend in the second pane (Bottom)
tmux split-window -v -t "$SESSION:dev" "npm run dev"

# Kill session when detached (ensures processes are stopped on close)
tmux set-hook -t "$SESSION" client-detached "kill-session"

# Attach
exec tmux attach -t "$SESSION"
