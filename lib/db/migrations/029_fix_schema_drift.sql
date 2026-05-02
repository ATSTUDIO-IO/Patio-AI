-- Migration #29: Fix schema drift in ciclos_billing
-- Removes deprecated columns veiculos_ativos and preco_unitario that were
-- replaced by valor_base and valor_excedente in an earlier billing refactor.
-- These columns had no readers in the API (Drizzle schema already omitted them).

ALTER TABLE ciclos_billing
  DROP COLUMN IF EXISTS veiculos_ativos,
  DROP COLUMN IF EXISTS preco_unitario;
