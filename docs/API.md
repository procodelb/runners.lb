# API Documentation

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@soufiam.com",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "admin@soufiam.com",
    "full_name": "Admin User",
    "role": "admin"
  }
}
```

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "full_name": "User Name"
}
```

## Orders

### Get Orders
```http
GET /api/orders?page=1&limit=20&status=delivered&type=ecommerce
Authorization: Bearer {token}
```

### Create Order
```http
POST /api/orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "order_ref": "ORD-2024-001",
  "type": "ecommerce",
  "customer_name": "John Doe",
  "customer_phone": "+961 3 123456",
  "customer_address": "Beirut, Lebanon",
  "brand_name": "Brand Name",
  "total_usd": 10.00,
  "delivery_fee_usd": 2.25,
  "payment_status": "unpaid"
}
```

### Update Order
```http
PATCH /api/orders/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "delivered",
  "payment_status": "paid"
}
```

### Batch Create Orders
```http
POST /api/orders/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "orders": [
    {
      "order_ref": "ORD-2024-001",
      "type": "ecommerce",
      "customer_name": "John Doe",
      "total_usd": 10.00
    }
  ]
}
```

## Cashbox

### Get Cashbox Balance
```http
GET /api/cashbox
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": 1,
  "balance_usd": 1000.00,
  "balance_lbp": 89000000,
  "cash_balance_usd": 800.00,
  "cash_balance_lbp": 71200000,
  "wish_balance_usd": 200.00,
  "wish_balance_lbp": 17800000,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Add Income
```http
POST /api/cashbox/income
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount_usd": 100.00,
  "amount_lbp": 8900000,
  "description": "Client payment",
  "category": "Revenue"
}
```

### Add Expense
```http
POST /api/cashbox/expense
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount_usd": 50.00,
  "amount_lbp": 4450000,
  "description": "Supplier payment",
  "category": "Operations"
}
```

### Get Cashbox Entries
```http
GET /api/cashbox/entries?page=1&limit=50
Authorization: Bearer {token}
```

## Accounting

### Get Client Accounting
```http
GET /api/accounting/clients/:id?from_date=2024-01-01&to_date=2024-12-31
Authorization: Bearer {token}
```

**Response:**
```json
{
  "client": {
    "id": 1,
    "business_name": "Client Name",
    "phone": "+961 3 123456"
  },
  "old_balance_usd": 0,
  "old_balance_lbp": 0,
  "orders": [
    {
      "id": 1,
      "order_ref": "ORD-001",
      "type": "ecommerce",
      "date": "2024-01-15",
      "total_usd": 100.00,
      "total_lbp": 8900000,
      "fee_usd": 2.25,
      "fee_lbp": 200000,
      "payment_status": "paid"
    }
  ],
  "summary": {
    "orders_sum_usd": 1000.00,
    "orders_sum_lbp": 89000000,
    "fees_usd": 22.50,
    "fees_lbp": 2000000,
    "payments_usd": 1000.00,
    "payments_lbp": 89000000,
    "new_balance_usd": 0,
    "new_balance_lbp": 0
  }
}
```

### Process Client Cashout
```http
POST /api/accounting/clients/:id/cashout
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount_usd": 500.00,
  "amount_lbp": 44500000,
  "order_ids": [1, 2, 3]
}
```

## Drivers

### Get Drivers
```http
GET /api/drivers?active=true
Authorization: Bearer {token}
```

### Get Driver Accounting
```http
GET /api/accounting/drivers/:id?from_date=2024-01-01&to_date=2024-12-31
Authorization: Bearer {token}
```

## Dashboard

### Get Stats
```http
GET /api/dashboard/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total_orders": 1000,
  "completed_orders": 800,
  "pending_orders": 200,
  "total_revenue_usd": 50000.00,
  "total_revenue_lbp": 4450000000,
  "total_expenses_usd": 10000.00,
  "total_expenses_lbp": 890000000,
  "net_profit_usd": 40000.00,
  "net_profit_lbp": 3560000000,
  "cashbox_balance_usd": 10000.00,
  "cashbox_balance_lbp": 890000000
}
```

## Export

### Export Client Statement CSV
```http
GET /api/accounting/clients/:id/export/csv
Authorization: Bearer {token}
```

### Export Client Statement PDF
```http
GET /api/accounting/clients/:id/export/pdf
Authorization: Bearer {token}
```

## Real-time Events (Socket.IO)

### Cashbox Update
```javascript
socket.on('cashbox-update', (data) => {
  console.log('Cashbox updated:', data);
  // data: { balance_usd, balance_lbp, ... }
});
```

### Order Update
```javascript
socket.on('order-update', (data) => {
  console.log('Order updated:', data);
  // data: { id, status, payment_status, ... }
});
```

### Accounting Update
```javascript
socket.on('accounting-update', (data) => {
  console.log('Accounting updated:', data);
});
```

