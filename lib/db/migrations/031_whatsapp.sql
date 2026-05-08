-- Migration #31: WhatsApp agent support
-- 1. Add WhatsApp credentials to lojas table
-- 2. Make conversas.qrcode_id nullable (WhatsApp conversations don't have QR code)
-- 3. Make conversas.veiculo_id nullable (WhatsApp conversations may not have specific vehicle)
-- 4. Add canal column to conversas (qr_patio | whatsapp)
-- 5. Make leads.veiculo_id nullable (WhatsApp leads may not be for a specific vehicle)

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS whatsapp_numero_id TEXT;
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

ALTER TABLE conversas ALTER COLUMN qrcode_id DROP NOT NULL;
ALTER TABLE conversas ALTER COLUMN veiculo_id DROP NOT NULL;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'qr_patio';

ALTER TABLE leads ALTER COLUMN veiculo_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversas_canal ON conversas (canal);
CREATE INDEX IF NOT EXISTS idx_lojas_whatsapp_numero ON lojas (whatsapp_numero_id);
