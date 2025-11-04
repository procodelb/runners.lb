-- Soufiam ERP Initial Seed Data
-- Seed: 001_initial_seed

BEGIN;

-- 1. Admin User
INSERT INTO users (email, password_hash, full_name, role, language, theme)
VALUES (
  'admin@soufiam.com',
  '$2a$10$rFJ5JjP8qQ0ZmVX9QZ5HhO8H5l5Z9QZ5HhO8H5l5Z9QZ5HhO8H5l5Z', -- bcrypt of 'admin123'
  'Admin User',
  'admin',
  'en',
  'light'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Exchange Rate
INSERT INTO exchange_rates (lbp_per_usd, effective_at)
VALUES (89000, now())
ON CONFLICT DO NOTHING;

-- 3. Sample Clients
INSERT INTO clients (business_name, contact_person, phone, address, category)
VALUES 
  ('Sample Client 1', 'John Doe', '+961 3 123456', 'Beirut, Lebanon', 'retail'),
  ('Sample Client 2', 'Jane Smith', '+961 3 789012', 'Tripoli, Lebanon', 'restaurant'),
  ('Sample Client 3', 'Bob Johnson', '+961 3 345678', 'Sidon, Lebanon', 'warehouse')
ON CONFLICT DO NOTHING;

-- 4. Sample Drivers
INSERT INTO drivers (full_name, phone, address, active, default_fee_usd, default_fee_lbp)
VALUES 
  ('Ahmed Ali', '+961 3 111111', 'Beirut', true, 2.50, 222500),
  ('Mohammad Hassan', '+961 3 222222', 'Tripoli', true, 2.50, 222500),
  ('Karim Saleh', '+961 3 333333', 'Sidon', true, 2.50, 222500)
ON CONFLICT DO NOTHING;

-- 5. Price List
INSERT INTO price_list (country, area, fees_lbp, fees_usd)
VALUES 
  ('Lebanon', 'Beirut', 200000, 2.25),
  ('Lebanon', 'Mount Lebanon', 250000, 2.81),
  ('Lebanon', 'North Lebanon', 300000, 3.37),
  ('Lebanon', 'South Lebanon', 300000, 3.37),
  ('Lebanon', 'Bekaa', 350000, 3.93),
  ('Lebanon', 'Nabatieh', 350000, 3.93)
ON CONFLICT DO NOTHING;

-- 6. Third Parties
INSERT INTO third_parties (name, contact_person, contact_phone, commission_rate, active)
VALUES 
  ('Third Party 1', 'Contact 1', '+961 3 999999', 10.00, true),
  ('Third Party 2', 'Contact 2', '+961 3 888888', 15.00, true)
ON CONFLICT DO NOTHING;

-- 7. Sample Orders (optional - for testing)
-- Uncomment if you want sample orders in the database
/*
INSERT INTO orders (order_ref, type, customer_name, customer_phone, customer_address, brand_name, status, payment_status, total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp, client_id, created_by)
VALUES 
  ('ORD-2024-001', 'ecommerce', 'Test Customer', '+961 3 000000', 'Beirut', 'Test Brand', 'delivered', 'paid', 10.00, 890000, 2.25, 200000, 1, 1),
  ('ORD-2024-002', 'instant', 'Test Customer 2', '+961 3 000001', 'Tripoli', 'Test Brand 2', 'completed', 'paid', 15.00, 1335000, 2.81, 250000, 2, 1)
ON CONFLICT (order_ref) DO NOTHING;
*/

COMMIT;

