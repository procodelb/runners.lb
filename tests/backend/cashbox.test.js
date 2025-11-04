const request = require('supertest');
const { Pool } = require('pg');
const app = require('../../server/index');

let pool;

beforeAll(async () => {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
});

afterAll(async () => {
  await pool.end();
});

describe('Cashbox Atomic Operations', () => {
  let authToken;

  beforeAll(async () => {
    // Login to get auth token
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@soufiam.com',
        password: 'admin123'
      });
    authToken = res.body.token;
  });

  describe('GET /api/cashbox', () => {
    it('should return cashbox balance', async () => {
      const res = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('balance_usd');
      expect(res.body).toHaveProperty('balance_lbp');
    });
  });

  describe('Prepaid Order Cash Flow', () => {
    it('should deduct cashbox on prepaid order creation', async () => {
      // Get initial balance
      const initialRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const initialBalance = initialRes.body.balance_usd;

      // Create prepaid order
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_ref: `TEST-PREPAID-${Date.now()}`,
          type: 'ecommerce',
          customer_name: 'Test Customer',
          customer_phone: '+961 3 000000',
          customer_address: 'Test Address',
          brand_name: 'Test Brand',
          status: 'new',
          payment_status: 'prepaid',
          total_usd: 10.00,
          delivery_fee_usd: 2.25
        });

      expect(orderRes.statusCode).toBe(201);

      // Check cashbox was deducted
      const updatedRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const updatedBalance = updatedRes.body.balance_usd;

      expect(updatedBalance).toBeLessThan(initialBalance);
    });

    it('should add cashbox on prepaid order delivery', async () => {
      // Find a prepaid order
      const ordersRes = await request(app)
        .get('/api/orders?payment_status=prepaid&status=new&limit=1')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (ordersRes.body.data.length === 0) {
        return; // Skip if no prepaid orders
      }

      const order = ordersRes.body.data[0];
      const initialBalance = ordersRes.body.balance_usd;

      // Update order to delivered + paid
      const updateRes = await request(app)
        .patch(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'delivered',
          payment_status: 'paid'
        });

      expect(updateRes.statusCode).toBe(200);

      // Check cashbox was credited
      const updatedRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const updatedBalance = updatedRes.body.balance_usd;

      expect(updatedBalance).toBeGreaterThan(initialBalance);
    });
  });

  describe('Client Cashout', () => {
    it('should deduct cashbox on client cashout', async () => {
      const initialRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const initialBalance = initialRes.body.balance_usd;

      const cashoutRes = await request(app)
        .post('/api/cashbox/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_usd: 50.00,
          description: 'Test cashout',
          category: 'Operations'
        });

      expect(cashoutRes.statusCode).toBe(201);

      const updatedRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const updatedBalance = updatedRes.body.balance_usd;

      expect(updatedBalance).toBeLessThan(initialBalance);
    });
  });

  describe('Concurrency Test', () => {
    it('should handle concurrent cashbox updates without race conditions', async () => {
      const initialRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const initialBalance = initialRes.body.balance_usd;

      // Create multiple concurrent requests
      const promises = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/api/cashbox/income')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount_usd: 10.00,
            description: `Concurrent test ${i}`,
            category: 'Test'
          })
      );

      await Promise.all(promises);

      const updatedRes = await request(app)
        .get('/api/cashbox')
        .set('Authorization', `Bearer ${authToken}`);
      const updatedBalance = updatedRes.body.balance_usd;

      // Balance should increase by exactly 10 * 10 = 100
      expect(updatedBalance).toBe(initialBalance + 100);
    });
  });
});

