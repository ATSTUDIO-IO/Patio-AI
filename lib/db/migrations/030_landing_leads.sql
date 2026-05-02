-- Migration #30: Create landing_leads table
-- Stores email/lead captures from the landing page "Acesso Antecipado" form.
-- This is separate from the main leads table (which requires veiculo_id and loja_id).

CREATE TABLE IF NOT EXISTS landing_leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL,
  telefone   TEXT,
  criado_em  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_leads_email     ON landing_leads (email);
CREATE INDEX IF NOT EXISTS idx_landing_leads_criado_em ON landing_leads (criado_em);
