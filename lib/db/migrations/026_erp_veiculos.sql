-- Migration #26: ERP Gestão Avançada de Veículos
-- Adds vehicle acquisition tracking, consignment data, patio time tracking,
-- and a new veiculo_despesas table for per-vehicle expense logging.

-- ─── New enum types ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tipo_aquisicao AS ENUM ('proprio', 'consignado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE categoria_despesa_veiculo AS ENUM ('manutencao_mecanica', 'manutencao_estetica', 'documentacao', 'outros');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── New columns on veiculos ──────────────────────────────────────────────────
ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS tipo_aquisicao      tipo_aquisicao   NOT NULL DEFAULT 'proprio',
  ADD COLUMN IF NOT EXISTS valor_aquisicao     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS consignado_proprietario_nome      TEXT,
  ADD COLUMN IF NOT EXISTS consignado_proprietario_telefone  TEXT,
  ADD COLUMN IF NOT EXISTS comissao_consignado_pct           NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS data_entrada_patio  DATE;

-- Backfill data_entrada_patio for existing vehicles (use created date)
UPDATE veiculos
SET data_entrada_patio = DATE(criado_em)
WHERE data_entrada_patio IS NULL;

-- ─── New table: veiculo_despesas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS veiculo_despesas (
  id          UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id  UUID                       NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  categoria   categoria_despesa_veiculo  NOT NULL,
  descricao   TEXT                       NOT NULL,
  valor       NUMERIC(10,2)              NOT NULL,
  data        DATE                       NOT NULL,
  criado_em   TIMESTAMP WITH TIME ZONE   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_veiculo ON veiculo_despesas(veiculo_id);
