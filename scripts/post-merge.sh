#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply migrations (idempotent — uses IF NOT EXISTS / ALTER TABLE ... IF NOT EXISTS)
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -f lib/db/migrations/030_landing_leads.sql
  psql "$DATABASE_URL" -f lib/db/migrations/031_whatsapp.sql
  psql "$DATABASE_URL" -f lib/db/migrations/032_whatsapp_sessoes.sql
fi
