# Backend Idempotency Specification for soufiamERP

## Overview

This document specifies the idempotency implementation required for the soufiamERP backend to support the offline-first API client. All mutating endpoints (POST, PUT, PATCH, DELETE) must support idempotency to ensure safe request replay.

## Idempotency Key Format

**Format:** `{type}-{timestamp}-{random}`

**Examples:**
- `erp-post-1696541234-3g7a9`
- `erp-put-1696541235-7h2k1`
- `erp-patch-1696541236-9m4n8`

**Components:**
- `type`: Request type (post, put, patch, delete)
- `timestamp`: Unix timestamp in seconds
- `random`: 9-character random string (alphanumeric)

## Required Headers

### Request Headers
- `Idempotency-Key`: Required for all mutating requests
- `Authorization`: Bearer token for authentication

### Response Headers
- `X-Idempotency-Status`: Indicates if this is a new request or replay
  - `new`: First time processing this key
  - `replay`: Returning cached response for existing key

## Implementation Requirements

### 1. Idempotency Storage

**Storage Backend:** Redis (preferred) or in-memory cache
**TTL:** 24 hours (86400 seconds)
**Key Format:** `idempotency:{key}`

**Storage Structure:**
```json
{
  "key": "erp-post-1696541234-3g7a9",
  "method": "POST",
  "url": "/api/orders",
  "status_code": 201,
  "response_body": {...},
  "created_at": "2023-10-05T10:30:00Z",
  "expires_at": "2023-10-06T10:30:00Z"
}
```

### 2. Middleware Implementation

**Location:** `server/middleware/idempotency.js`

**Functionality:**
1. Extract `Idempotency-Key` from request headers
2. Check if key exists in storage
3. If exists, return cached response with `X-Idempotency-Status: replay`
4. If not exists, process request normally
5. Store response with key for future replays

### 3. Endpoint Requirements

All mutating endpoints must support idempotency:

#### Orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `PATCH /api/orders/:id` - Partial update order
- `DELETE /api/orders/:id` - Delete order
- `POST /api/orders/:id/assign-driver` - Assign driver
- `POST /api/orders/:id/complete` - Complete order
- `POST /api/orders/:id/payments` - Add payment

#### Payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id` - Update payment
- `PATCH /api/payments/:id` - Partial update payment
- `DELETE /api/payments/:id` - Delete payment

#### Driver Advances
- `POST /api/driver-advances` - Create advance
- `PATCH /api/driver-advances/:id/clear` - Clear advance
- `PATCH /api/driver-advances/:id/reimburse` - Reimburse advance

#### Cashbox
- `POST /api/cashbox/entry` - Add cashbox entry
- `POST /api/cashbox/driver-advance` - Process driver advance

#### Accounting
- `POST /api/accounting/transactions` - Create transaction
- `PUT /api/accounting/transactions/:id` - Update transaction
- `PATCH /api/accounting/transactions/:id` - Partial update transaction

## Response Format

### Success Response (New Request)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "reference": "ORD-001",
    "status": "created",
    "created_at": "2023-10-05T10:30:00Z"
  },
  "idempotency_key": "erp-post-1696541234-3g7a9"
}
```

**Headers:**
- `X-Idempotency-Status: new`
- `Content-Type: application/json`

### Success Response (Replay)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "reference": "ORD-001",
    "status": "created",
    "created_at": "2023-10-05T10:30:00Z"
  },
  "idempotency_key": "erp-post-1696541234-3g7a9"
}
```

**Headers:**
- `X-Idempotency-Status: replay`
- `Content-Type: application/json`

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid order data",
    "details": {
      "field": "customer_name",
      "reason": "Required field missing"
    }
  },
  "idempotency_key": "erp-post-1696541234-3g7a9"
}
```

## Implementation Example

### Express.js Middleware

```javascript
const redis = require('redis');
const client = redis.createClient();

const idempotencyMiddleware = async (req, res, next) => {
  // Only apply to mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required for mutating requests'
      }
    });
  }

  try {
    // Check if key exists
    const cached = await client.get(`idempotency:${idempotencyKey}`);
    
    if (cached) {
      const cachedResponse = JSON.parse(cached);
      res.set('X-Idempotency-Status', 'replay');
      return res.status(cachedResponse.status_code).json(cachedResponse.response_body);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache response
    res.json = function(data) {
      // Cache the response
      const cacheData = {
        key: idempotencyKey,
        method: req.method,
        url: req.originalUrl,
        status_code: res.statusCode,
        response_body: data,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      client.setex(`idempotency:${idempotencyKey}`, 86400, JSON.stringify(cacheData));
      
      // Set replay header
      res.set('X-Idempotency-Status', 'new');
      
      // Call original json method
      return originalJson(data);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next();
  }
};

module.exports = idempotencyMiddleware;
```

### Route Implementation

```javascript
const express = require('express');
const router = express.Router();
const idempotencyMiddleware = require('../middleware/idempotency');

// Apply idempotency middleware to all routes
router.use(idempotencyMiddleware);

// Orders routes
router.post('/orders', async (req, res) => {
  try {
    const order = await createOrder(req.body);
    res.status(201).json({
      success: true,
      data: order,
      idempotency_key: req.headers['idempotency-key']
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'ORDER_CREATION_FAILED',
        message: error.message
      },
      idempotency_key: req.headers['idempotency-key']
    });
  }
});

module.exports = router;
```

## Health Check Endpoint

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-10-05T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "idempotency": "enabled"
  }
}
```

## Error Handling

### Missing Idempotency Key
- **Status:** 400 Bad Request
- **Message:** "Idempotency-Key header is required for mutating requests"

### Invalid Idempotency Key Format
- **Status:** 400 Bad Request
- **Message:** "Invalid Idempotency-Key format"

### Storage Errors
- **Status:** 500 Internal Server Error
- **Message:** "Idempotency service temporarily unavailable"
- **Behavior:** Continue processing request without caching

## Testing Requirements

### Unit Tests
1. Test idempotency key generation
2. Test cache storage and retrieval
3. Test replay functionality
4. Test error handling

### Integration Tests
1. Test complete request flow with idempotency
2. Test concurrent requests with same key
3. Test cache expiration
4. Test error scenarios

### Load Tests
1. Test with high concurrent requests
2. Test cache performance
3. Test memory usage

## Security Considerations

1. **Key Validation:** Validate idempotency key format
2. **Rate Limiting:** Implement per-key rate limiting
3. **Storage Security:** Encrypt sensitive data in cache
4. **Access Control:** Ensure proper authentication

## Monitoring and Metrics

### Metrics to Track
- Idempotency key usage (new vs replay)
- Cache hit/miss rates
- Storage errors
- Response times

### Alerts
- High error rates
- Storage failures
- Unusual key patterns

## Migration Strategy

1. **Phase 1:** Implement middleware and basic endpoints
2. **Phase 2:** Add to all mutating endpoints
3. **Phase 3:** Add monitoring and optimization
4. **Phase 4:** Add advanced features (TTL customization, etc.)

## Configuration

### Environment Variables
```bash
IDEMPOTENCY_ENABLED=true
IDEMPOTENCY_TTL=86400
IDEMPOTENCY_REDIS_URL=redis://localhost:6379
IDEMPOTENCY_MAX_KEYS=1000000
```

### Redis Configuration
```bash
# Redis configuration for idempotency
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

This specification ensures that the backend can safely handle request replays from the offline-first API client, providing a robust foundation for the ERP system's network resilience.
