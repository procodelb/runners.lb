# Delivery Prices Integration Guide

## Overview

This guide documents the complete delivery price integration system for the Soufiam ERP, featuring dual currency support (LBP/USD), automatic price injection, and comprehensive accounting functionality.

## 🚀 Features Implemented

### 1. Delivery Prices Management
- **Dual Currency Support**: Prices in both Lebanese Pounds (LBP) and US Dollars (USD)
- **Hierarchical Location Structure**: Country → Region → Sub-Region
- **Automatic Price Lookup**: Orders automatically get delivery prices based on location
- **Bulk Import/Export**: CSV and Excel file support for price management
- **Price Validation**: Comprehensive validation and error handling

### 2. Enhanced Accounting System
- **Client Account Tracking**: Individual client balance management
- **Payment Processing**: Record and track all client payments
- **Balance Calculations**: Real-time balance updates (Old Balance + Orders - Payments)
- **Statement Generation**: Detailed client statements with transaction history
- **Dual Currency Support**: All accounting in both LBP and USD

### 3. Order Integration
- **Automatic Price Injection**: Delivery prices automatically applied when creating orders
- **Location-Based Pricing**: Prices determined by delivery country/region/sub-region
- **Fallback Logic**: Graceful handling when exact location match not found
- **Price Override**: Manual price entry still supported

## 📊 Database Schema

### New Tables Created

#### 1. `delivery_prices`
```sql
CREATE TABLE delivery_prices (
  id SERIAL PRIMARY KEY,
  country TEXT NOT NULL DEFAULT 'Lebanon',
  region TEXT NOT NULL,
  sub_region TEXT,
  price_lbp BIGINT NOT NULL DEFAULT 0,
  price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(country, region, sub_region)
);
```

#### 2. `payments`
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  amount_lbp BIGINT NOT NULL DEFAULT 0,
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_date TIMESTAMPTZ DEFAULT now(),
  description TEXT,
  reference_number TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. `client_accounts`
```sql
CREATE TABLE client_accounts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  old_balance_lbp BIGINT DEFAULT 0,
  old_balance_usd NUMERIC(10,2) DEFAULT 0,
  current_balance_lbp BIGINT DEFAULT 0,
  current_balance_usd NUMERIC(10,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);
```

#### 4. Enhanced `orders` Table
```sql
ALTER TABLE orders 
ADD COLUMN delivery_country TEXT DEFAULT 'Lebanon',
ADD COLUMN delivery_region TEXT,
ADD COLUMN delivery_sub_region TEXT,
ADD COLUMN delivery_price_id INTEGER REFERENCES delivery_prices(id) ON DELETE SET NULL;
```

### Views Created

#### 1. `client_balances`
```sql
CREATE VIEW client_balances AS
SELECT 
  c.id as client_id,
  c.business_name,
  c.contact_person,
  c.phone,
  COALESCE(ca.old_balance_lbp, 0) as old_balance_lbp,
  COALESCE(ca.old_balance_usd, 0) as old_balance_usd,
  COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) as pending_orders_lbp,
  COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) as pending_orders_usd,
  COALESCE(SUM(p.amount_lbp), 0) as total_payments_lbp,
  COALESCE(SUM(p.amount_usd), 0) as total_payments_usd,
  (COALESCE(ca.old_balance_lbp, 0) + 
   COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) - 
   COALESCE(SUM(p.amount_lbp), 0)) as current_balance_lbp,
  (COALESCE(ca.old_balance_usd, 0) + 
   COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) - 
   COALESCE(SUM(p.amount_usd), 0)) as current_balance_usd
FROM clients c
LEFT JOIN client_accounts ca ON c.id = ca.client_id
LEFT JOIN orders o ON (c.business_name = o.customer_name OR c.id::text = o.customer_name)
LEFT JOIN payments p ON c.id = p.client_id
GROUP BY c.id, c.business_name, c.contact_person, c.phone, ca.old_balance_lbp, ca.old_balance_usd;
```

## 🔌 API Endpoints

### Delivery Prices API (`/api/delivery-prices`)

#### GET `/api/delivery-prices`
- **Purpose**: Get all delivery prices with filtering and pagination
- **Query Parameters**:
  - `page`, `limit`: Pagination
  - `country`, `region`: Filter by location
  - `search`: Search in country/region/sub_region
  - `is_active`: Filter by active status
  - `sortBy`, `sortOrder`: Sorting options

#### GET `/api/delivery-prices/:id`
- **Purpose**: Get single delivery price by ID

#### POST `/api/delivery-prices`
- **Purpose**: Create new delivery price
- **Body**: `{ country, region, sub_region, price_lbp, price_usd, is_active }`

#### PUT `/api/delivery-prices/:id`
- **Purpose**: Update existing delivery price

#### DELETE `/api/delivery-prices/:id`
- **Purpose**: Delete delivery price (with usage validation)

#### GET `/api/delivery-prices/lookup/location`
- **Purpose**: Lookup delivery price by location
- **Query Parameters**: `country`, `region`, `sub_region`

#### POST `/api/delivery-prices/bulk-import`
- **Purpose**: Bulk import delivery prices from array
- **Body**: `{ prices: [...] }`

#### GET `/api/delivery-prices/meta/locations`
- **Purpose**: Get countries, regions, and sub-regions for dropdowns

#### GET `/api/delivery-prices/export/csv`
- **Purpose**: Export delivery prices as CSV

### Payments API (`/api/payments`)

#### GET `/api/payments`
- **Purpose**: Get all payments with filtering and pagination

#### POST `/api/payments`
- **Purpose**: Create new payment
- **Body**: `{ client_id, order_id, amount_lbp, amount_usd, payment_method, description }`

#### GET `/api/payments/client/:client_id`
- **Purpose**: Get payment history for specific client

#### GET `/api/payments/stats/summary`
- **Purpose**: Get payment statistics and summaries

### Client Accounts API (`/api/client-accounts`)

#### GET `/api/client-accounts`
- **Purpose**: Get all client accounts with balance information

#### GET `/api/client-accounts/:client_id`
- **Purpose**: Get detailed client account information

#### PUT `/api/client-accounts/:client_id`
- **Purpose**: Update client account (set old balance)

#### POST `/api/client-accounts/:client_id/recalculate`
- **Purpose**: Recalculate client balance

#### GET `/api/client-accounts/:client_id/statement`
- **Purpose**: Generate client statement (JSON or CSV)

#### POST `/api/client-accounts/recalculate-all`
- **Purpose**: Bulk recalculate all client balances

### Price Import API (`/api/price-import`)

#### POST `/api/price-import/upload`
- **Purpose**: Upload and process CSV/Excel file
- **Content-Type**: `multipart/form-data`
- **Body**: File upload with field name `file`

#### GET `/api/price-import/template`
- **Purpose**: Download CSV template for price import

#### POST `/api/price-import/validate`
- **Purpose**: Validate price data before import
- **Body**: `{ prices: [...] }`

#### POST `/api/price-import/bulk-update`
- **Purpose**: Bulk update delivery prices
- **Body**: `{ prices: [...], update_mode: 'upsert'|'insert_only'|'update_only' }`

## 🔄 Workflow Integration

### Order Creation with Automatic Price Injection

1. **Order Creation Request**:
   ```json
   {
     "customer_name": "Client Name",
     "delivery_country": "Lebanon",
     "delivery_region": "El Koura",
     "delivery_sub_region": "Aaba",
     "total_lbp": 0,
     "total_usd": 0
   }
   ```

2. **Automatic Price Lookup**:
   - System searches for exact match: `country + region + sub_region`
   - If not found, falls back to: `country + region` (without sub_region)
   - If still not found, uses manual prices provided

3. **Price Application**:
   - `delivery_fee_lbp` and `delivery_fee_usd` automatically set
   - `delivery_price_id` linked to the matched price record
   - Order totals updated accordingly

### Payment Processing Workflow

1. **Payment Creation**:
   ```json
   {
     "client_id": 123,
     "order_id": 456,
     "amount_lbp": 100000,
     "amount_usd": 1.12,
     "payment_method": "cash"
   }
   ```

2. **Automatic Updates**:
   - Client account balance updated
   - Order payment status recalculated
   - Transaction record created
   - Balance views refreshed

### Balance Calculation Formula

```
Current Balance = Old Balance + Unpaid Orders - Payments

Where:
- Old Balance: Initial balance set for client
- Unpaid Orders: Sum of all orders with payment_status = 'unpaid'
- Payments: Sum of all payments made by client
```

## 📁 File Import/Export

### CSV Import Format

```csv
country,region,sub_region,price_lbp,price_usd
Lebanon,Beirut,Hamra,200000,2.25
Lebanon,El Koura,Aaba,200000,0.0
Lebanon,Mount Lebanon,,250000,2.81
```

### Supported Column Names

The system supports multiple column name variations:
- **Country**: `country`, `country_name`
- **Region**: `region`, `district`, `area`
- **Sub-Region**: `sub_region`, `location_name_en`, `location_name_arabic`
- **LBP Price**: `price_lbp`, `lpb_delivery_fees`, `fees_lbp`
- **USD Price**: `price_usd`, `usd_delivery_fees`, `fees_usd`

## 🧪 Testing

### Integration Test

Run the comprehensive integration test:

```bash
node test-delivery-prices-integration.js
```

This test covers:
- ✅ Delivery Prices API functionality
- ✅ Client Accounts API functionality
- ✅ Order creation with automatic price injection
- ✅ Payment processing and balance updates
- ✅ Price import/export functionality

### Manual Testing Steps

1. **Create Delivery Price**:
   ```bash
   curl -X POST http://localhost:5000/api/delivery-prices \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"country":"Lebanon","region":"Test Region","price_lbp":150000,"price_usd":1.69}'
   ```

2. **Create Order with Location**:
   ```bash
   curl -X POST http://localhost:5000/api/orders \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"customer_name":"Test Client","delivery_region":"Test Region","total_lbp":0}'
   ```

3. **Verify Automatic Price Injection**:
   - Check that `delivery_fee_lbp` and `delivery_fee_usd` are automatically set
   - Verify `delivery_price_id` is linked to the correct price record

## 🚀 Deployment

### Database Migration

1. **Run the migration script**:
   ```bash
   cd server
   node scripts/createDeliveryPricesSchema.js
   ```

2. **Verify tables created**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name IN ('delivery_prices', 'payments', 'client_accounts');
   ```

3. **Check sample data**:
   ```sql
   SELECT COUNT(*) FROM delivery_prices;
   SELECT COUNT(*) FROM client_balances;
   ```

### Server Configuration

1. **Add new routes** (already done in `server/index.js`):
   ```javascript
   app.use('/api/delivery-prices', authenticateToken, deliveryPricesRoutes);
   app.use('/api/payments', authenticateToken, paymentsRoutes);
   app.use('/api/client-accounts', authenticateToken, clientAccountsRoutes);
   app.use('/api/price-import', authenticateToken, priceImportRoutes);
   ```

2. **Restart server**:
   ```bash
   npm start
   ```

## 📈 Performance Considerations

### Database Indexes

The following indexes are automatically created for optimal performance:

```sql
-- Delivery prices indexes
CREATE INDEX idx_delivery_prices_country_region ON delivery_prices(country, region);
CREATE INDEX idx_delivery_prices_active ON delivery_prices(is_active);

-- Payments indexes
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Client accounts indexes
CREATE INDEX idx_client_accounts_client_id ON client_accounts(client_id);

-- Orders indexes
CREATE INDEX idx_orders_delivery_location ON orders(delivery_country, delivery_region);
CREATE INDEX idx_orders_delivery_price_id ON orders(delivery_price_id);
```

### Query Optimization

- **Price Lookup**: Uses indexed queries for fast location-based price retrieval
- **Balance Calculations**: Leverages database views for efficient balance computation
- **Pagination**: All list endpoints support pagination to handle large datasets

## 🔒 Security Considerations

### Authentication
- All endpoints require valid JWT token
- User context tracked for audit trails

### Data Validation
- Input validation on all API endpoints
- SQL injection prevention through parameterized queries
- File upload restrictions (size, type)

### Access Control
- Role-based access control (admin/user roles)
- Audit logging for all financial transactions

## 🐛 Troubleshooting

### Common Issues

1. **Delivery Price Not Applied**:
   - Check if location exactly matches database records
   - Verify `is_active = true` for the price record
   - Check server logs for lookup errors

2. **Balance Calculation Errors**:
   - Run balance recalculation: `POST /api/client-accounts/:id/recalculate`
   - Check for orphaned orders or payments
   - Verify client name matching between orders and clients table

3. **Import Failures**:
   - Validate CSV format using template
   - Check for duplicate entries
   - Verify required fields are present

### Debug Queries

```sql
-- Check delivery price lookup
SELECT * FROM delivery_prices 
WHERE country = 'Lebanon' AND region = 'El Koura' AND is_active = true;

-- Check client balance calculation
SELECT * FROM client_balances WHERE client_id = 123;

-- Check order delivery price linkage
SELECT o.*, dp.price_lbp, dp.price_usd 
FROM orders o 
LEFT JOIN delivery_prices dp ON o.delivery_price_id = dp.id 
WHERE o.id = 456;
```

## 📞 Support

For issues or questions regarding the delivery prices integration:

1. Check the integration test results
2. Review server logs for error messages
3. Verify database schema and sample data
4. Test individual API endpoints using the provided examples

## 🎯 Future Enhancements

### Planned Features
- **Real-time Price Updates**: WebSocket notifications for price changes
- **Price History**: Track price changes over time
- **Advanced Reporting**: Detailed analytics and reporting dashboards
- **Mobile API**: Optimized endpoints for mobile applications
- **Multi-language Support**: Arabic/English price display
- **Price Rules Engine**: Complex pricing rules based on multiple factors

### Integration Opportunities
- **Third-party Logistics**: Integration with external delivery services
- **Payment Gateways**: Direct payment processing integration
- **Accounting Software**: Export to QuickBooks, Xero, etc.
- **Business Intelligence**: Advanced analytics and forecasting

---

**🎉 Congratulations!** Your ERP system now has a complete delivery price integration with dual currency support, automatic price injection, and comprehensive accounting functionality. The system is production-ready and fully tested.
