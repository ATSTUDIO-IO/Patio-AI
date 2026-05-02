-- Migration #27: Mencionar Tempo no Pátio
-- Adds a flag to lojas that controls whether the voice agent should mention
-- long dwell time (90+ days) as a negotiation argument with buyers.

ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS mencionar_tempo_patio BOOLEAN NOT NULL DEFAULT false;
