#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply the landing_leads migration (idempotent — uses IF NOT EXISTS)
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -f lib/db/migrations/030_landing_leads.sql
fi
