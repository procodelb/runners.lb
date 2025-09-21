const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Batch create orders
router.post('/', authenticateToken, async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders array is required and must not be empty'
      });
    }

    await client.query('BEGIN');
    
    const createdOrders = [];
    const errors = [];

    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      
      try {
        // Validate required fields
        if (!orderData.brand_name && !orderData.customer_name) {
          errors.push(`Order ${i + 1}: brand_name or customer_name is required`);
          continue;
        }

        // Generate order reference if not provided
        const orderRef = orderData.order_ref || generateOrderRef();
        
        // Prepare order data
        const order = {
          order_ref: orderRef,
          type: orderData.type || 'ecommerce',
          is_purchase: orderData.is_purchase ? 1 : 0,
          customer_phone: orderData.customer_phone || '',
          customer_name: orderData.customer_name || '',
          customer_address: orderData.customer_address || '',
          brand_name: orderData.brand_name || '',
          voucher_code: orderData.voucher_code || '',
          deliver_method: orderData.deliver_method || 'in_house',
          delivery_mode: orderData.delivery_mode || 'direct',
          third_party_name: orderData.third_party_name || '',
          third_party_fee_usd: parseFloat(orderData.third_party_fee_usd) || 0,
          third_party_fee_lbp: parseInt(orderData.third_party_fee_lbp) || 0,
          driver_id: orderData.driver_id || null,
          driver_fee_usd: parseFloat(orderData.driver_fee_usd) || 0,
          driver_fee_lbp: parseInt(orderData.driver_fee_lbp) || 0,
          instant: orderData.instant ? 1 : 0,
          notes: orderData.notes || '',
          total_usd: parseFloat(orderData.total_usd) || 0,
          total_lbp: parseInt(orderData.total_lbp) || 0,
          delivery_fee_usd: parseFloat(orderData.delivery_fee_usd) || 0,
          delivery_fee_lbp: parseInt(orderData.delivery_fee_lbp) || 0,
          status: orderData.status || 'new',
          payment_status: orderData.payment_status || 'unpaid',
          prepaid_status: orderData.prepaid_status || 'unpaid',
          latitude: orderData.latitude || null,
          longitude: orderData.longitude || null,
          location_text: orderData.location_text || '',
          created_by: req.user.id
        };

        // Insert order
        const insertQuery = `
          INSERT INTO orders (
            order_ref, type, is_purchase, customer_phone, customer_name, customer_address,
            brand_name, voucher_code, deliver_method, delivery_mode, third_party_name,
            third_party_fee_usd, third_party_fee_lbp, driver_id, driver_fee_usd, driver_fee_lbp,
            instant, notes, total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp,
            status, payment_status, prepaid_status, latitude, longitude, location_text, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
          ) RETURNING *
        `;

        const values = [
          order.order_ref, order.type, order.is_purchase, order.customer_phone, order.customer_name,
          order.customer_address, order.brand_name, order.voucher_code, order.deliver_method,
          order.delivery_mode, order.third_party_name, order.third_party_fee_usd, order.third_party_fee_lbp,
          order.driver_id, order.driver_fee_usd, order.driver_fee_lbp, order.instant, order.notes,
          order.total_usd, order.total_lbp, order.delivery_fee_usd, order.delivery_fee_lbp,
          order.status, order.payment_status, order.prepaid_status, order.latitude, order.longitude,
          order.location_text, order.created_by
        ];

        const result = await client.query(insertQuery, values);
        createdOrders.push(result.rows[0]);

      } catch (error) {
        errors.push(`Order ${i + 1}: ${error.message}`);
      }
    }

    if (errors.length > 0 && createdOrders.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'All orders failed to create',
        errors
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdOrders.length} orders`,
      data: createdOrders,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch orders creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create batch orders',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Batch assign driver to orders
router.patch('/assign', authenticateToken, async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const { order_ids, driver_id } = req.body;
    
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'order_ids array is required and must not be empty'
      });
    }

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: 'driver_id is required'
      });
    }

    await client.query('BEGIN');

    // Update all orders
    const updateQuery = `
      UPDATE orders 
      SET driver_id = $1, status = 'assigned', updated_at = now()
      WHERE id = ANY($2)
      RETURNING id, order_ref, driver_id, status
    `;

    const result = await client.query(updateQuery, [driver_id, order_ids]);
    
    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully assigned driver to ${result.rows.length} orders`,
      data: result.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver to orders',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Client autocomplete/search
router.get('/clients/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchQuery = `
      SELECT 
        id,
        business_name,
        contact_person,
        phone,
        address,
        instagram,
        website,
        google_location
      FROM clients 
      WHERE LOWER(business_name) LIKE LOWER($1) 
         OR LOWER(contact_person) LIKE LOWER($1)
         OR LOWER(phone) LIKE LOWER($1)
      ORDER BY 
        CASE 
          WHEN LOWER(business_name) LIKE LOWER($1) THEN 1
          WHEN LOWER(contact_person) LIKE LOWER($1) THEN 2
          ELSE 3
        END,
        business_name
      LIMIT 10
    `;

    const results = await query(searchQuery, [`%${q}%`]);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Client search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search clients',
      error: error.message
    });
  }
});

// Get client details by phone or business name
router.get('/clients/details', authenticateToken, async (req, res) => {
  try {
    const { phone, business_name } = req.query;
    
    if (!phone && !business_name) {
      return res.status(400).json({
        success: false,
        message: 'phone or business_name is required'
      });
    }

    let whereClause = '';
    let params = [];

    if (phone) {
      whereClause = 'WHERE phone = $1';
      params = [phone];
    } else if (business_name) {
      whereClause = 'WHERE LOWER(business_name) = LOWER($1)';
      params = [business_name];
    }

    const clientQuery = `
      SELECT 
        id,
        business_name,
        contact_person,
        phone,
        address,
        instagram,
        website,
        google_location,
        category
      FROM clients 
      ${whereClause}
      LIMIT 1
    `;

    const results = await query(clientQuery, params);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });

  } catch (error) {
    console.error('Get client details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client details',
      error: error.message
    });
  }
});

// Helper function to generate order reference
function generateOrderRef() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

module.exports = router;