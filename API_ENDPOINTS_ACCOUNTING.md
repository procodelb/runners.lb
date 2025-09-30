Soufiam ERP Accounting & Orders API – Key Payloads

POST /api/orders/batch
- Body: { orders: [ { client|client_name|brand_name, customer, customer_phone, customer_address, delivery_mode, price_usd|price_lbp, fee_usd|fee_lbp|delivery_fee_usd|delivery_fee_lbp|driver_fees_usd|driver_fees_lbp, third_party_id, third_party_fee_usd|third_party_fee_lbp, driver_id, is_purchase, notes, prepaid_status } ] }
- Response: created rows

PATCH /api/orders/:id
- Body: { status, payment_status, driver_id, fee_usd, fee_lbp, delivery_fee_usd, delivery_fee_lbp, notes }
- Effects: if status=delivered and payment_status=paid → delivery_fee credit, third_party_payout/driver_payout debits; completed_at set.

PATCH /api/orders/assign
- Body: { order_ids: number[], driver_id: number }
- Response: updated orders with driver assignment

POST /api/orders/:id/complete
- Body: { status?=completed, payment_status?=paid }
- Effects: ledger entries (delivery_fee credit, third_party_payout debit, optional driver_payout), cashbox entry if paid total, order_history append.

GET /api/accounting/clients
- Query: from_date?, to_date?, search?
- Response: per-client aggregates (orders_total_*, fees_total_*, payments_total_*, new_balance_*)

GET /api/accounting/clients/:id
- Query: from_date?, to_date?
- Response: client, orders, transactions, totals and balances (dual currency)

POST /api/accounting/clients/:id/cashout
- Body: { amount_usd?, amount_lbp?, description? }
- Effect: creates transaction (client_cashout), ledgered

GET /api/transactions
- Query filters: tx_type?, actor_type?, actor_id?, from_date?, to_date?
- Response: transactions with joins

POST /api/transactions
- Body: { tx_type, amount_usd?, amount_lbp?, actor_type?, actor_id?, description?, order_id?, category?, direction? }
- Rule: if only one currency provided, backend computes the other.

GET /api/cashbox
- Returns snapshot balances

POST /api/cashbox/income
POST /api/cashbox/expense
- Body: { amount_usd?, amount_lbp?, description? }
- Rule: backend computes missing currency and updates ledger + balances atomically.


