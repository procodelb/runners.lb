# Cashbox & Payment Rules Implementation Complete

## 🎯 Overview

This document describes the complete implementation of authoritative cashbox and payment rules for Soufiam ERP. The system now tracks every monetary event affecting the company's cash account with atomic transactions, row-level locking, and comprehensive audit trails.

---

## 🏗️ Architecture

### Database Schema Changes

#### 1. **Orders Table** - New Fields

```sql
ALTER TABLE orders ADD COLUMN:
  - cashbox_applied_on_create BOOLEAN DEFAULT false
  - cashbox_applied_on_delivery BOOLEAN DEFAULT false
  - cashbox_applied_on_paid BOOLEAN DEFAULT false
  - cashbox_history_moved BOOLEAN DEFAULT false
  - client_id INTEGER REFERENCES clients(id)
  - third_party_fee_usd NUMERIC(10,2)
  - third_party_fee_lbp BIGINT
  - delivered_at TIMESTAMPTZ
```

**Purpose**: Track which cashbox operations have been applied to prevent duplicate entries.

#### 2. **Cashbox Table** - Enhanced Structure

```sql
ALTER TABLE cashbox ADD COLUMN:
  - cash_balance_usd NUMERIC(12,2)
  - cash_balance_lbp BIGINT
  - wish_balance_usd NUMERIC(12,2)
  - wish_balance_lbp BIGINT
  - initial_capital_usd NUMERIC(12,2)
  - initial_capital_lbp BIGINT
  - capital_set_at TIMESTAMPTZ
  - capital_set_by INTEGER REFERENCES users(id)
```

**Purpose**: Support dual-account system (cash + wish) and capital tracking.

#### 3. **Cashbox_Entries Table** - Enhanced Entry Types

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

**Business Flow**:
```
Prepaid order created with payment_status='paid'
  → Debit cash account by total amount (order_cash_out)
  → When order later becomes delivered
  → Credit cash account by total amount (order_cash_in)
```

**Implementation** (`processOrderCashDeduction`):
- Checks if `cashbox_applied_on_create` is false
- Computes amounts in both USD and LBP using latest exchange rate
- Debits cashbox with row-level locking (`SELECT ... FOR UPDATE`)
- Creates `order_cash_out` entry
- Creates accounting transaction
- Marks order as `cashbox_applied_on_create = true`
- Emits `cashbox-update` Socket.IO event

### Rule 2: Delivered Status Flow

**Business Flow**:
```
Order status changes to 'delivered'
  → Credit cash account by order total (order_cash_in)
  → Mark as cashbox_applied_on_delivery = true
  → Record in cashbox_entries and transactions
  → When client cashout happens
  → Debit cash account by cashout amount (client_cashout)
  → Move order to order_history (cashbox_history_moved = true)
```

**Implementation** (`processOrderCashCredit`):
- Checks if `cashbox_applied_on_delivery` is false (prevents duplicate)
- Credits cashbox with row-level locking
- Creates `order_cash_in` entry
- Creates accounting transaction
- Marks order as `cashbox_applied_on_delivery = true`
- Emits `cashbox-update`, `payment-update` Socket.IO events

### Rule 3: Go-to-Market Orders

**Business Flow**:
```
Go-to-market order created (is_purchase = true)
  → Debit cash account by total (order_cash_out)
  → When order delivered + client cashout
  → Credit cash account by collected amount (order_cash_in)
```

**Implementation**:
- Same as prepaid orders but triggered by `is_purchase` or `type='go_to_market'`
- Uses `shouldCashOutOnCreate()` helper function

### Rule 4: Client Cashout

**Business Flow**:
```
Process client cashout
  → Debit cash account by cashout amount
  → Create client_cashout entry
  → Create transaction for client payable
  → Move related orders to history
```

**Implementation** (`processClientCashout`):
- Debits cashbox with row-level locking
- Creates `client_cashout` entry
- Creates accounting transaction (`debit_account='cash_account'`, `credit_account='client_payable'`)
- Marks orders as moved to history
- Emits `cashbox-update`, `transaction-update` events

---

## 🔒 Concurrency & Race Condition Prevention

### Row-Level Locking

Every cashbox operation uses `SELECT ... FOR UPDATE` to lock the cashbox row:

```javascript
const cashbox = await client.query(
  'SELECT * FROM cashbox WHERE id = 1 FOR UPDATE'
);
```

**Why**: Prevents multiple concurrent transactions from modifying cashbox balances simultaneously, ensuring balance consistency.

### Atomic Transactions

All cashbox operations are wrapped in PostgreSQL transactions:

```javascript
await client.query('BEGIN');
try {
  // 1. Lock cashbox row
  // 2. Update cashbox balances
  // 3. Create cashbox_entry
  // 4. Create transaction
  // 5. Update order flags
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

**Why**: Ensures all-or-nothing operations. If any step fails, everything rolls back.

---

## 📡 Socket.IO Integration

### Events Emitted

#### **cashbox-update**
```javascript
io.emit('cashbox-update', {
  orderRef: 'ORD-20250101-123',
  action: 'created' | 'delivered' | 'paid',
  cashDelta: { usd: 100, lbp: 8900000 }
});
```

#### **payment-update**
```javascript
io.emit('payment-update', {
  orderRef: 'ORD-20250101-123',
  payment_status: 'paid',
  amount: { usd: 100, lbp: 8900000 }
});
```

#### **transaction-update**
```javascript
io.emit('transaction-update', {
  orderRef: 'ORD-20250101-123',
  type: 'order_cash_in',
  description: 'Cash in for delivered order',
  cashDelta: { usd: 100, lbp: 8900000 }
});
```

#### **order-update**
```javascript
io.emit('order-update', {
  orderRef: 'ORD-20250101-123',
  status: 'delivered',
  payment_status: 'paid',
  driverName: 'Ahmed'
});
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
  "total_usd": 100,
  ...
}
Expected: Cashbox decreases by 100 USD
Expected: cashbox_entries.entry_type = 'order_cash_out'

// 2. Mark as delivered
PATCH /api/orders/:id
{ "status": "delivered" }
Expected: Cashbox increases by 100 USD
Expected: cashbox_entries.entry_type = 'order_cash_in'
Expected: No duplicate entries
```

### Test 2: Go-to-Market Order

```javascript
// 1. Create go-to-market order
POST /api/orders
{
  "type": "go_to_market",
  "is_purchase": true,
  "total_usd": 50,
  ...
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

## 🔧 API Endpoints

### Order Endpoints (Enhanced)

**POST /api/orders**
- Creates order with atomic cashbox operations
- Handles prepaid/go-to-market cash deduction
- Emits Socket.IO events

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

## 📊 Example Data Flow

### Example 1: Ecommerce Prepaid Order

```
1. Customer pays $100 for order ORD-001
   POST /api/orders
   → Order created: { payment_status: 'paid', type: 'ecommerce' }
   → shouldCashOutOnCreate() returns true
   → BEGIN TRANSACTION
   → Lock cashbox row
   → Deduct $100 USD + 8,900,000 LBP from cashbox
   → Create order_cash_out entry
   → Create transaction (debit operating_expense, credit cash_account)
   → Mark order cashbox_applied_on_create = true
   → COMMIT
   → Emit: cashbox-update, order-update
   
2. Order delivered
   PATCH /api/orders/:id { status: 'delivered' }
   → BEGIN TRANSACTION
   → Lock cashbox row
   → Add $100 USD + 8,900,000 LBP to cashbox
   → Create order_cash_in entry
   → Create transaction (debit cash_account, credit revenue)
   → Mark order cashbox_applied_on_delivery = true
   → COMMIT
   → Emit: cashbox-update, payment-update, transaction-update
```

### Example 2: Client Accounting Workflow

```
1. Client has 3 delivered orders totaling $300
2. Process client cashout
   POST /api/accounting/clients/:id/cashout
   {
     "amount_usd": 300,
     "order_ids": [1, 2, 3]
   }
   → BEGIN TRANSACTION
   → Lock cashbox row
   → Deduct $300 USD from cashbox
   → Create client_cashout entry
   → Create transaction (debit client_payable, credit cash_account)
   → Mark orders cashbox_history_moved = true
   → COMMIT
   → Emit: cashbox-update, transaction-update
```

---

## 🚀 Deployment Instructions

### 1. Run Migration

```bash
cd server
node scripts/migrateCashboxPaymentRules.js
```

This will:
- Add new columns to orders table
- Update cashbox table structure
- Add new entry types to cashbox_entries
- Create necessary indexes

### 2. Update Environment Variables

Ensure these are set in `.env`:
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
```

### 3. Test the Migration

```bash
npm run test
```

### 4. Deploy

```bash
# Backend (Render)
git push origin main

# Frontend (Vercel)
vercel --prod
```

---

## ✅ Acceptance Criteria

- ✅ Prepaid order scenario: Creates order_cash_out on creation, order_cash_in on delivery
- ✅ Delivered scenario: Credits cashbox exactly once
- ✅ Client cashout: Deducts from cashbox and moves orders to history
- ✅ Go-to-market: Debits on creation, credits on delivery
- ✅ Third-party delivery: Records net and payable separately
- ✅ Instant vs Ecommerce: UI behavior matches specifications
- ✅ Concurrency: Row-level locking prevents race conditions
- ✅ Events: All actions emit Socket.IO events

---

## 📝 Developer Notes

### Key Functions

**`cashboxAtomicOperations.js`**:
- `processOrderCashDeduction()` - Handles cash out on order creation
- `processOrderCashCredit()` - Handles cash in on delivery/payment
- `processClientCashout()` - Handles client cashout
- `shouldCashOutOnCreate()` - Determines if cash should be deducted
- `updateCashboxBalances()` - Atomic balance updates with locking
- `createCashboxEntry()` - Creates audit entries
- `createTransaction()` - Creates accounting entries

**`migrateCashboxPaymentRules.js`**:
- Database migration script
- Adds new columns and constraints
- Updates entry types
- Creates indexes

### File Structure

```
server/
├── routes/
│   ├── orders.js (enhanced with atomic operations)
│   ├── cashbox.js
│   └── accounting.js
├── utils/
│   └── cashboxAtomicOperations.js (NEW)
├── scripts/
│   └── migrateCashboxPaymentRules.js (NEW)
└── config/
    └── database.js
```

---

## 🐛 Troubleshooting

### Issue: Duplicate Cashbox Entries

**Cause**: Race condition or missing flags check

**Solution**: Ensure `cashbox_applied_on_delivery` check before creating entry

```javascript
if (!currentOrder.cashbox_applied_on_delivery) {
  await processOrderCashCredit(client, orderId, order, userId, 'delivery');
}
```

### Issue: Negative Cashbox Balance

**Cause**: Concurrent operations or insufficient locking

**Solution**: Use row-level locking (`SELECT ... FOR UPDATE`)

### Issue: Socket.IO Events Not Firing

**Cause**: IO instance not passed to routes

**Solution**: Ensure `io` is accessible via `req.app.get('io')`

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
✅ **Comprehensive Audit Trail** - Every change recorded in cashbox_entries
✅ **Real-Time Updates** - Socket.IO events for live UI
✅ **Duplicate Prevention** - Boolean flags prevent double-counting
✅ **Multi-Currency Support** - Both USD and LBP tracked
✅ **Dual-Account System** - Cash and Wish accounts supported

**Status**: ✅ **PRODUCTION READY**

