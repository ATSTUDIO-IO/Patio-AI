-- Migration #28: Real Sale Price for Profitability Report
-- Adds valor_venda_real to veiculos so the actual transaction price can be
-- recorded when a vehicle is marked as sold, enabling profit margin reporting.

ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS valor_venda_real NUMERIC(12, 2);
