-- Soufiam ERP Production Schema Migration
-- Migration: 001_initial_schema

BEGIN;

-- Exchange Rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  lbp_per_usd NUMERIC(18,6) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_at ON exchange_rates(effective_at DESC);

-- Third Parties
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

-- Delivery Prices
CREATE TABLE IF NOT EXISTS delivery_prices (
  id SERIAL PRIMARY KEY,
  country TEXT DEFAULT 'Lebanon',
  region TEXT NOT NULL,
  sub_region TEXT,
  price_lbp BIGINT DEFAULT 0,
  price_usd NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_prices_region ON delivery_prices(country, region, COALESCE(sub_region,'~'));
CREATE INDEX IF NOT EXISTS idx_delivery_prices_active ON delivery_prices(is_active);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  instagram TEXT,
  website TEXT,
  google_location TEXT,
  category TEXT,
  old_balance_usd NUMERIC(12,2) DEFAULT 0,
  old_balance_lbp BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(business_name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  default_fee_lbp BIGINT DEFAULT 0,
  default_fee_usd NUMERIC(10,2) DEFAULT 0,
  balance_usd NUMERIC(12,2) DEFAULT 0,
  balance_lbp BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_active ON drivers(active);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);

-- Price List
CREATE TABLE IF NOT EXISTS price_list (
  id SERIAL PRIMARY KEY,
  country TEXT DEFAULT 'Lebanon',
  area TEXT NOT NULL,
  fees_lbp BIGINT DEFAULT 200000,
  fees_usd NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_list_country_area ON price_list(country, area);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_ref TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ecommerce','instant','go_to_market')),
  is_purchase BOOLEAN DEFAULT false,
  customer_phone TEXT,
  customer_name TEXT,
  customer_address TEXT,
  brand_name TEXT,
  voucher_code TEXT,
  deliver_method TEXT CHECK (deliver_method IN ('in_house','third_party')),
  third_party_name TEXT,
  third_party_id INTEGER REFERENCES third_parties(id) ON DELETE SET NULL,
  third_party_fee_usd NUMERIC(10,2) DEFAULT 0,
  third_party_fee_lbp BIGINT DEFAULT 0,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  driver_fee_usd NUMERIC(10,2) DEFAULT 0,
  driver_fee_lbp BIGINT DEFAULT 0,
  instant BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','assigned','picked_up','in_transit','delivered','completed','cancelled','returned')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','prepaid','refunded')),
  total_usd NUMERIC(12,2) DEFAULT 0,
  total_lbp BIGINT DEFAULT 0,
  delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
  delivery_fee_lbp BIGINT DEFAULT 0,
  fee_usd NUMERIC(12,2) DEFAULT 0,
  fee_lbp BIGINT DEFAULT 0,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  -- Cashbox tracking fields
  cashbox_applied_on_create BOOLEAN DEFAULT false,
  cashbox_applied_on_delivery BOOLEAN DEFAULT false,
  cashbox_applied_on_paid BOOLEAN DEFAULT false,
  cashbox_history_moved BOOLEAN DEFAULT false,
  accounting_cashed BOOLEAN DEFAULT false,
  moved_to_history BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  moved_at TIMESTAMPTZ,
  -- Location fields
  delivery_country TEXT DEFAULT 'Lebanon',
  delivery_region TEXT,
  delivery_sub_region TEXT,
  delivery_price_id INTEGER REFERENCES delivery_prices(id) ON DELETE SET NULL,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  location_text TEXT,
  external_id TEXT,
  -- Computed fields
  computed_total_usd NUMERIC(12,2) DEFAULT 0,
  computed_total_lbp BIGINT DEFAULT 0,
  prepaid_status BOOLEAN DEFAULT false,
  delivery_mode TEXT DEFAULT 'direct'
);

CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_brand_name ON orders(brand_name);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_cashbox_flags ON orders(cashbox_applied_on_create, cashbox_applied_on_delivery, cashbox_applied_on_paid);

-- Transactions
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
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

-- Cashbox
CREATE TABLE IF NOT EXISTS cashbox (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  balance_usd NUMERIC(12,2) DEFAULT 0,
  balance_lbp BIGINT DEFAULT 0,
  cash_balance_usd NUMERIC(12,2) DEFAULT 0,
  cash_balance_lbp BIGINT DEFAULT 0,
  wish_balance_usd NUMERIC(12,2) DEFAULT 0,
  wish_balance_lbp BIGINT DEFAULT 0,
  initial_balance_usd NUMERIC(12,2) DEFAULT 0,
  initial_balance_lbp BIGINT DEFAULT 0,
  initial_capital_usd NUMERIC(12,2) DEFAULT 0,
  initial_capital_lbp BIGINT DEFAULT 0,
  capital_set_at TIMESTAMPTZ,
  capital_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO cashbox (id, balance_usd, balance_lbp, cash_balance_usd, cash_balance_lbp, wish_balance_usd, wish_balance_lbp)
VALUES (1, 0, 0, 0, 0, 0, 0) ON CONFLICT (id) DO NOTHING;

-- Cashbox Entries
CREATE TABLE IF NOT EXISTS cashbox_entries (
  id SERIAL PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'cash_in', 'cash_out', 'order_cash_in', 'order_cash_out', 
    'client_cashout', 'prepaid_cashout', 'driver_advance', 'driver_return',
    'driver_payout', 'third_party_payable', 'capital_add',
    'capital_edit', 'income', 'expense', 'capital_expense'
  )),
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp BIGINT DEFAULT 0,
  actor_type TEXT,
  actor_id INTEGER,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  account_type TEXT CHECK (account_type IN ('cash', 'wish')) DEFAULT 'cash',
  category TEXT,
  subcategory TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashbox_entries_order_id ON cashbox_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_cashbox_entries_entry_type ON cashbox_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_cashbox_entries_created_at ON cashbox_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_cashbox_entries_actor ON cashbox_entries(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_cashbox_entries_created_by ON cashbox_entries(created_by);

-- Order History
CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, created_at);

-- Cashbox Assignments
CREATE TABLE IF NOT EXISTS cashbox_assignments (
  id SERIAL PRIMARY KEY,
  assign_date DATE NOT NULL DEFAULT CURRENT_DATE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  assigned_usd NUMERIC(12,2) DEFAULT 0,
  assigned_lbp BIGINT DEFAULT 0,
  returned_usd NUMERIC(12,2) DEFAULT 0,
  returned_lbp BIGINT DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assign_date, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_cashbox_assignments_driver ON cashbox_assignments(driver_id, assign_date);

COMMIT;

