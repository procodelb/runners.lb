# 💰 Cashbox & Payment Rules - Complete Implementation Guide

## 📋 Overview

This document provides complete documentation for the cashbox and payment rules implementation in Soufiam ERP. The system ensures every monetary event affecting company cash is tracked with atomic transactions, row-level locking, and comprehensive audit trails.

---

## 🎯 What Was Implemented

### Core Features

1. **Atomic Cashbox Operations** - All cashbox updates are atomic (all-or-nothing)
2. **Row-Level Locking** - Prevents race conditions during concurrent operations
3. **Duplicate Prevention** - Boolean flags prevent duplicate cashbox entries
4. **Multi-Currency Support** - Tracks both USD and LBP with automatic exchange rate conversion
5. **Dual-Account System** - Supports Cash and Wish account types
6. **Comprehensive Audit Trail** - Every operation is logged in cashbox_entries and transactions
7. **Real-Time Updates** - Socket.IO events for live UI updates

---

## 🗄️ Database Schema Changes

### Orders Table - New Fields

```sql
ALTER TABLE orders ADD COLUMN:
  - cashbox_applied_on_create BOOLEAN DEFAULT false
  - cashbox_applied_on_delivery BOOLEAN DEFAULT false
  - cashbox_applied_on_paid BOOLEAN DEFAULT false
  - cashbox_history_moved BOOLEAN DEFAULT false
  - client_id INTEGER REFERENCES clients(id)
  - third_party_fee_usd NUMERIC(10,2) DEFAULT 0
  - third_party_fee_lbp BIGINT DEFAULT 0
  - delivered_at TIMESTAMPTZ
```

**Purpose**: Track which cashbox operations have been applied to prevent duplicate entries.

### Cashbox Table - Enhanced Structure

```sql
ALTER TABLE cashbox ADD COLUMN:
  - cash_balance_usd NUMERIC(12,2) DEFAULT 0
  - cash_balance_lbp BIGINT DEFAULT 0
  - wish_balance_usd NUMERIC(12,2) DEFAULT 0
  - wish_balance_lbp BIGINT DEFAULT 0
  - initial_capital_usd NUMERIC(12,2) DEFAULT 0
  - initial_capital_lbp BIGINT DEFAULT 0
  - capital_set_at TIMESTAMPTZ
  - capital_set_by INTEGER REFERENCES users(id)
```

**Purpose**: Support dual-account system and capital tracking.

### Cashbox_Entries Table - Enhanced Entry Types

```sql
ALTER TABLE cashbox_entries ADD COLUMN:
  - order_id INTEGER REFERENCES orders(id)
  - account_type TEXT CHECK (account_type IN ('cash', 'wish'))
  - category TEXT
  - subcategory TEXT
  - notes TEXT
```

**New Entry Types**:
- `order_cash_in` - Money flowing into cashbox from delivered orders
- `order_cash_out` - Money flowing out of cashbox for prepaid orders
- `client_cashout` - Money paid to clients
- `third_party_payable` - Money owed to third-party delivery services
- `driver_payout` - Money paid to drivers
- `driver_advance` - Advances given to drivers
- `driver_return` - Driver returns/refunds

---

## 🔄 Business Rules Implementation

### Rule 1: Prepaid Orders

**Flow**:
```
1. Create order with payment_status='paid'
   → Debit cashbox (order_cash_out)
   → Mark cashbox_applied_on_create = true
   → Create cashbox_entry
   → Create transaction

2. Mark order as delivered
   → Credit cashbox (order_cash_in)
   → Mark cashbox_applied_on_delivery = true
   → Create cashbox_entry
   → Create transaction
   → Emit Socket.IO events
```

**Implementation**:
- `processOrderCashDeduction()` handles cash out on creation
- `processOrderCashCredit()` handles cash in on delivery
- Prevents duplicates using boolean flags

### Rule 2: Delivered Status Flow

**Flow**:
```
1. Order status changes to 'delivered'
   → Credit cashbox (order_cash_in)
   → Mark cashbox_applied_on_delivery = true
   → Create cashbox_entry
   → Create transaction
   → Emit Socket.IO events

2. Client cashout happens
   → Debit cashbox (client_cashout)
   → Mark cashbox_history_moved = true
   → Create cashbox_entry
   → Create transaction
   → Emit Socket.IO events
```

**Implementation**:
- Checks `cashbox_applied_on_delivery` before crediting (prevents duplicate)
- Uses row-level locking for concurrent safety

### Rule 3: Go-to-Market Orders

**Flow**:
```
1. Create order with is_purchase=true or type='go_to_market'
   → Debit cashbox (order_cash_out)
   → Mark cashbox_applied_on_create = true
   → Create cashbox_entry
   → Create transaction

2. Order delivered
   → Credit cashbox (order_cash_in)
   → Mark cashbox_applied_on_delivery = true
   → Create cashbox_entry
   → Create transaction
```

**Implementation**:
- Uses `shouldCashOutOnCreate()` to determine if cash should be deducted
- Same atomic operations as prepaid orders

### Rule 4: Client Cashout

**Flow**:
```
1. Process client cashout
   → Debit cashbox (client_cashout)
   → Create cashbox_entry
   → Create transaction (debit cash_account, credit client_payable)
   → Mark orders cashbox_history_moved = true
   → Emit Socket.IO events
```

**Implementation**:
- `processClientCashout()` handles cashout with atomic operations
- Deducts from cashbox with row-level locking
- Creates proper accounting transactions

---

## 🔒 Concurrency & Safety

### Row-Level Locking

Every cashbox operation locks the row before updating:

```javascript
const cashbox = await client.query(
  'SELECT * FROM cashbox WHERE id = 1 FOR UPDATE'
);
```

**Why**: Prevents concurrent transactions from modifying balances simultaneously.

### Atomic Transactions

All operations wrapped in transactions:

```javascript
await client.query('BEGIN');
try {
  // 1. Lock cashbox
  // 2. Update balances
  // 3. Create entry
  // 4. Create transaction
  // 5. Update order flags
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

**Why**: Ensures all-or-nothing operations. If any step fails, everything rolls back.

### Duplicate Prevention

Boolean flags prevent duplicate entries:
- `cashbox_applied_on_create` - Prevents double deduction on creation
- `cashbox_applied_on_delivery` - Prevents double credit on delivery
- `cashbox_applied_on_paid` - Prevents double credit on payment
- `cashbox_history_moved` - Prevents double move to history

---

## 📡 Socket.IO Integration

### Events Emitted

**`cashbox-update`** - When cashbox balance changes
```javascript
io.emit('cashbox-update', {
  orderRef: 'ORD-20250101-123',
  action: 'created' | 'delivered' | 'paid',
  cashDelta: { usd: 100, lbp: 8900000 }
});
```

**`payment-update`** - When payment is received
```javascript
io.emit('payment-update', {
  orderRef: 'ORD-20250101-123',
  payment_status: 'paid',
  amount: { usd: 100, lbp: 8900000 }
});
```

**`transaction-update`** - When transaction is created
```javascript
io.emit('transaction-update', {
  orderRef: 'ORD-20250101-123',
  type: 'order_cash_in',
  description: 'Cash in for delivered order'
});
```

**`order-update`** - When order status changes
```javascript
io.emit('order-update', {
  orderRef: 'ORD-20250101-123',
  status: 'delivered',
  payment_status: 'paid',
  driverName: 'Ahmed'
});
```

---

## 🚀 Deployment Instructions

### Step 1: Run Migration

```bash
cd server
node scripts/migrateCashboxPaymentRules.js
```

**What it does**:
- Adds new columns to orders table
- Updates cashbox table structure
- Adds new entry types to cashbox_entries
- Creates necessary indexes
- Initializes cashbox row if it doesn't exist

### Step 2: Verify Migration

```bash
# Check orders table has new columns
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name LIKE 'cashbox_%'"

# Check cashbox table
psql $DATABASE_URL -c "SELECT * FROM cashbox"

# Check cashbox_entries constraint
psql $DATABASE_URL -c "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='cashbox_entries' AND constraint_name LIKE '%entry_type%'"
```

### Step 3: Test Implementation

```bash
# Test prepaid order creation
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_name": "Test Customer",
    "customer_phone": "1234567890",
    "type": "ecommerce",
    "payment_status": "paid",
    "total_usd": 100
  }'

# Check cashbox was debited
curl -X GET http://localhost:5000/api/cashbox/balance \
  -H "Authorization: Bearer $TOKEN"

# Check cashbox entries
curl -X GET http://localhost:5000/api/cashbox/timeline \
  -H "Authorization: Bearer $TOKEN"

# Test marking order as delivered
curl -X PATCH http://localhost:5000/api/orders/:id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "delivered"
  }'

# Verify cashbox was credited
curl -X GET http://localhost:5000/api/cashbox/balance \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Deploy to Production

```bash
# Backend (Render)
git add .
git commit -m "Implement cashbox and payment rules with atomic transactions"
git push origin main

# Frontend (Vercel)
cd client
vercel --prod
```

---

## 🧪 Testing Scenarios

### Test 1: Prepaid Order Lifecycle

```javascript
// 1. Create prepaid order
POST /api/orders
{
  "type": "ecommerce",
  "payment_status": "paid",
  "total_usd": 100
}
Expected: Cashbox decreases by 100 USD
Expected: cashbox_entries.entry_type = 'order_cash_out'
Expected: cashbox_applied_on_create = true

// 2. Mark as delivered
PATCH /api/orders/:id
{ "status": "delivered" }
Expected: Cashbox increases by 100 USD
Expected: cashbox_entries.entry_type = 'order_cash_in'
Expected: cashbox_applied_on_delivery = true
Expected: No duplicate entries
```

### Test 2: Go-to-Market Order

```javascript
// 1. Create go-to-market order
POST /api/orders
{
  "type": "go_to_market",
  "is_purchase": true,
  "total_usd": 50
}
Expected: Cashbox decreases by 50 USD
Expected: cashbox_applied_on_create = true

// 2. Mark delivered
PATCH /api/orders/:id
{ "status": "delivered" }
Expected: Cashbox increases by 50 USD
Expected: cashbox_applied_on_delivery = true
```

### Test 3: Client Cashout

```javascript
// 1. Client has delivered order with balance
// 2. Cash out client
POST /api/accounting/clients/:id/cashout
{
  "amount_usd": 200,
  "order_ids": [1, 2, 3]
}
Expected: Cashbox decreases by 200 USD
Expected: cashbox_entries.entry_type = 'client_cashout'
Expected: Orders marked cashbox_history_moved = true
```

### Test 4: Concurrent Order Creation

```javascript
// Simulate 10 parallel order creations
Promise.all([
  createOrder({ total_usd: 10 }),
  createOrder({ total_usd: 20 }),
  ...
])

Expected: Final balance = initial_balance - (10 + 20 + ...)
Expected: No race conditions
Expected: All entries recorded correctly
```

---

## 📊 API Endpoints

### Order Endpoints (Enhanced)

**POST /api/orders**
- Creates order with atomic cashbox operations
- Handles prepaid/go-to-market cash deduction
- Emits Socket.IO events
- Returns order with cashbox tracking flags

**PATCH /api/orders/:id**
- Updates order status with cashbox credit on delivery
- Handles payment status changes
- Prevents duplicate cashbox entries
- Emits real-time updates

**GET /api/orders/:id**
- Returns order with cashbox flags
- Includes `cashbox_applied_on_create`, `cashbox_applied_on_delivery`

### Cashbox Endpoints

**GET /api/cashbox/balance**
- Returns current balances (cash + wish)
- Includes detailed breakdown

**GET /api/cashbox/timeline**
- Returns recent cashbox entries
- Includes order references and descriptions

**POST /api/cashbox/income**
- Add income with atomic cashbox update

**POST /api/cashbox/expense**
- Add expense with atomic cashbox update

**POST /api/cashbox/capital**
- Set initial capital
- Creates capital entry

### Accounting Endpoints

**POST /api/accounting/clients/:id/cashout**
- Process client cashout
- Debits cashbox atomically
- Moves orders to history
- Emits Socket.IO events

---

## 🔑 Key Files

### Core Implementation Files

1. **`server/utils/cashboxAtomicOperations.js`**
   - Core cashbox logic with atomic transactions
   - Row-level locking implementation
   - All business rule functions

2. **`server/scripts/migrateCashboxPaymentRules.js`**
   - Database migration script
   - Adds new columns and constraints
   - Updates entry types

3. **`server/routes/orders.js`**
   - Enhanced with atomic cashbox operations
   - Uses functions from cashboxAtomicOperations
   - Socket.IO event emission

### Documentation Files

1. **`CASHBOX_PAYMENT_RULES_IMPLEMENTATION.md`**
   - Complete implementation details
   - Business rules documentation
   - Architecture overview

2. **`CASHBOX_IMPLEMENTATION_SUMMARY.md`**
   - Quick reference guide
   - Deployment instructions
   - Troubleshooting guide

3. **`README_CASHBOX_IMPLEMENTATION.md`**
   - This file - complete user guide

---

## 🐛 Troubleshooting

### Issue: "cashbox row not found"
**Solution**: Run migration script to create initial cashbox row
```bash
node scripts/migrateCashboxPaymentRules.js
```

### Issue: "duplicate cashbox entries"
**Solution**: Check boolean flags before creating entries
```javascript
if (!order.cashbox_applied_on_delivery) {
  await processOrderCashCredit(client, orderId, order, userId, 'delivery');
}
```

### Issue: "negative cashbox balance"
**Solution**: Use row-level locking (`SELECT ... FOR UPDATE`)

### Issue: "Socket.IO events not firing"
**Solution**: Ensure `io` is accessible via `req.app.get('io')`

---

## ✅ Acceptance Criteria

- ✅ Prepaid order scenario: Creates order_cash_out on creation, order_cash_in on delivery
- ✅ Delivered scenario: Credits cashbox exactly once (no duplicates)
- ✅ Client cashout: Deducts from cashbox and moves orders to history
- ✅ Go-to-market: Debits on creation, credits on delivery
- ✅ Third-party delivery: Records net and payable separately
- ✅ Instant vs Ecommerce: UI behavior matches specifications
- ✅ Concurrency: Row-level locking prevents race conditions
- ✅ Events: All actions emit Socket.IO events

---

## 📈 Performance Considerations

- **Row-Level Locking**: Minimal performance impact, ensures correctness
- **Transaction Duration**: Keep transactions short (< 100ms)
- **Indexes**: Added on `cashbox_entries(order_id, entry_type, created_at)`
- **Socket.IO**: Events batched to prevent flooding

---

## 🎉 Summary

The cashbox and payment rules implementation provides:

✅ **Atomic Operations** - All-or-nothing cashbox updates
✅ **Row-Level Locking** - Prevents race conditions
✅ **Comprehensive Audit Trail** - Every change recorded in cashbox_entries and transactions
✅ **Real-Time Updates** - Socket.IO events for live UI
✅ **Duplicate Prevention** - Boolean flags prevent double-counting
✅ **Multi-Currency Support** - Both USD and LBP tracked
✅ **Dual-Account System** - Cash and Wish accounts supported

**Status**: ✅ **PRODUCTION READY**

---

**Generated**: $(date)
**Version**: 1.0.0

