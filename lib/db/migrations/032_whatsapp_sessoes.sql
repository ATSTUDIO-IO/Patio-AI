-- Migration #32: Persist WhatsApp sessions in database for restart survivability

CREATE TABLE IF NOT EXISTS whatsapp_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from" TEXT NOT NULL,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  ultima_mensagem_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  veiculo_id_detectado UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_sessoes_from_loja
  ON whatsapp_sessoes ("from", loja_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessoes_ultima_mensagem
  ON whatsapp_sessoes (ultima_mensagem_em);
