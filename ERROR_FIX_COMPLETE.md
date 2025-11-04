# ✅ Error Fixed - Accounting API

## Problem
```
❌ Query error: invalid input syntax for type integer: "Dive In"
WHERE ... OR o.client_id = $2
Params: [ 'Dive In', 'Dive In' ]
```

**Root Cause**: The query was trying to compare an INTEGER column (`client_id`) with a STRING value ("Dive In"), which PostgreSQL correctly rejects.

## Solution
Updated `server/routes/accounting.js` to intelligently handle `clientId`:

**Before**:
```javascript
if (clientId) {
  whereClause += ' AND (o.brand_name = $1 OR o.client_id = $2)';
  params.push(clientId, clientId); // Always pushes clientId twice
}
```

**After**:
```javascript
if (clientId) {
  const isNumeric = !isNaN(parseInt(clientId));
  if (isNumeric) {
    // If numeric, it's a client ID
    whereClause += ' AND o.client_id = $' + (params.length + 1);
    params.push(parseInt(clientId));
  } else {
    // If string, it's a brand name
    whereClause += ' AND o.brand_name = $' + (params.length + 1);
    params.push(clientId);
  }
}
```

## Result
✅ **FIXED** - The accounting page should now work correctly!

**Test**: Click "Dive In" in the Accounting page - it should load the orders without errors.

