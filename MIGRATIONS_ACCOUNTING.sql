-- Soufiam ERP – Neon PostgreSQL migrations for full accounting & dual currency

-- 1) Exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  lbp_per_usd NUMERIC(18,6) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed one rate if empty
INSERT INTO exchange_rates(lbp_per_usd)
SELECT 89000 WHERE NOT EXISTS (SELECT 1 FROM exchange_rates);

-- 2) Third parties
CREATE TABLE IF NOT EXISTS third_parties (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  email TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Delivery prices
CREATE TABLE IF NOT EXISTS delivery_prices (
  id SERIAL PRIMARY KEY,
  country TEXT DEFAULT 'Lebanon',
  region TEXT NOT NULL,
  sub_region TEXT,
  price_lbp BIGINT DEFAULT 0,
  price_usd NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_prices_region ON delivery_prices(country, region, COALESCE(sub_region,'~'));
CREATE INDEX IF NOT EXISTS idx_delivery_prices_active ON delivery_prices(is_active);

-- 4) Orders – additive changes only
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepaid_status BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS third_party_id INTEGER REFERENCES third_parties(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'direct';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_usd NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_lbp BIGINT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_country TEXT DEFAULT 'Lebanon';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_region TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_sub_region TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price_id INTEGER REFERENCES delivery_prices(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_text TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id TEXT;

-- 5) Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  tx_type TEXT NOT NULL,
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp BIGINT DEFAULT 0,
  actor_type TEXT,
  actor_id INTEGER,
  debit_account TEXT,
  credit_account TEXT,
  description TEXT,
  category TEXT,
  direction TEXT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_actor ON transactions(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- 6) Cashbox (single row id=1)
CREATE TABLE IF NOT EXISTS cashbox (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  balance_usd NUMERIC(12,2) DEFAULT 0,
  balance_lbp BIGINT DEFAULT 0,
  initial_balance_usd NUMERIC(12,2) DEFAULT 0,
  initial_balance_lbp BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO cashbox (id, balance_usd, balance_lbp)
  VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING;

-- 7) Cashbox entries/history
CREATE TABLE IF NOT EXISTS cashbox_entries (
  id SERIAL PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in','cash_out','driver_advance','driver_return','client_payment')),
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp BIGINT DEFAULT 0,
  actor_type TEXT,
  actor_id INTEGER,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8) Order history / audit
CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, created_at);


