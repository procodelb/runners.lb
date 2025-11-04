# ✅ Accounting API Error - FIXED

## Problem

The `/accounting/clients?clientId=Dive+In` endpoint was returning **500 Internal Server Error**.

## Root Cause

The accounting routes were querying for columns that didn't exist yet:
- `accounting_cashed` 
- `moved_to_history`

The migration script initially only added new cashbox columns but didn't add these legacy columns that existing code expected.

## Solution

Updated the migration script (`server/scripts/migrateCashboxPaymentRules.js`) to add:
- `accounting_cashed BOOLEAN DEFAULT false`
- `moved_to_history BOOLEAN DEFAULT false`  
- `moved_at TIMESTAMPTZ`

And ran the migration successfully:
```bash
✅ Cashbox Payment Rules migration completed successfully!
```

## Fixes Applied

1. ✅ Added missing legacy columns to migration script
2. ✅ Ran migration on database
3. ✅ Updated PostgreSQL placeholder syntax in some queries

## ⚠️ Action Required

**You need to restart your server** for the changes to take effect:

```bash
# Stop the server (Ctrl+C in the server terminal)
# Then restart it:
cd server
npm start
```

After restarting, the `/accounting/clients` endpoint should work correctly.

## Testing

After restarting, test the endpoint:

```bash
# Should return 200 OK
GET http://localhost:5000/api/accounting/clients?clientId=Dive+In
```

---

**Status**: ✅ **FIXED** (Server restart required)

