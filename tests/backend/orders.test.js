const request = require('supertest');
const app = require('../../server/index');

describe('Orders API', () => {
  let authToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@soufiam.com',
        password: 'admin123'
      });
    authToken = res.body.token;
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_ref: `TEST-${Date.now()}`,
          type: 'ecommerce',
          customer_name: 'Test Customer',
          customer_phone: '+961 3 000000',
          customer_address: 'Test Address',
          brand_name: 'Test Brand',
          status: 'new',
          payment_status: 'unpaid',
          total_usd: 10.00
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });

    it('should enforce order_ref uniqueness', async () => {
      const orderRef = `TEST-UNIQUE-${Date.now()}`;
      
      // Create first order
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_ref: orderRef,
          type: 'ecommerce',
          customer_name: 'Test',
          customer_phone: '+961 3 000000',
          brand_name: 'Test Brand',
          total_usd: 10.00
        });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_ref: orderRef,
          type: 'ecommerce',
          customer_name: 'Test',
          customer_phone: '+961 3 000000',
          brand_name: 'Test Brand',
          total_usd: 10.00
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/orders', () => {
    it('should return paginated orders', async () => {
      const res = await request(app)
        .get('/api/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('should filter orders by status', async () => {
      const res = await request(app)
        .get('/api/orders?status=delivered')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.every(order => order.status === 'delivered')).toBe(true);
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update order status', async () => {
      // Get an order
      const ordersRes = await request(app)
        .get('/api/orders?limit=1')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (ordersRes.body.data.length === 0) {
        return; // Skip if no orders
      }

      const orderId = ordersRes.body.data[0].id;

      const res = await request(app)
        .patch(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'assigned'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

