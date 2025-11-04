const express = require('express');
const { query, run, usdToLbp, lbpToUsd } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { computeDisplayedAmounts } = require('../utils/computeDisplayedAmounts');
const router = express.Router();

// Batch create orders
router.post('/', authenticateToken, async (req, res) => {
  const { getPool } = require('../config/database');
  const pool = getPool();
  const client = await pool.connect();
  
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
        // Adapter mappings and validations
        const clientName = orderData.client_name || orderData.client || orderData.brand_name || '';
        const customerName = orderData.customer || orderData.customer_name || '';
        if (!clientName && !customerName) {
          errors.push(`Order ${i + 1}: client/brand_name or customer_name is required`);
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
          customer_name: customerName,
          customer_address: orderData.customer_address || '',
          brand_name: clientName,
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
          total_usd: 0,
          total_lbp: 0,
          delivery_fee_usd: 0,
          delivery_fee_lbp: 0,
          status: orderData.status || 'new',
          payment_status: orderData.payment_status || 'unpaid',
          prepaid_status: orderData.prepaid_status === 'prepaid' ? 'prepaid' : 'not_prepaid',
          latitude: orderData.latitude || null,
          longitude: orderData.longitude || null,
          location_text: orderData.location_text || '',
          created_by: req.user.id
        };

        // Map potential driver_fees to delivery fees if frontend sends wrong key
        const deliveryFeeUsdInput = orderData.delivery_fee_usd ?? orderData.fee_usd ?? orderData.fees_usd ?? orderData.driver_fees_usd ?? orderData.driver_fee_usd ?? 0;
        const deliveryFeeLbpInput = orderData.delivery_fee_lbp ?? orderData.fee_lbp ?? orderData.fees_lbp ?? orderData.driver_fees_lbp ?? orderData.driver_fee_lbp ?? 0;

        // Dual currency compute for delivery fees
        let dfUsd = Number(deliveryFeeUsdInput) || 0;
        let dfLbp = Number(deliveryFeeLbpInput) || 0;
        if (dfUsd > 0 && (!dfLbp || dfLbp === 0)) {
          dfLbp = await usdToLbp(dfUsd);
        } else if (dfLbp > 0 && (!dfUsd || dfUsd === 0)) {
          dfUsd = await lbpToUsd(dfLbp);
        }
        order.delivery_fee_usd = dfUsd;
        order.delivery_fee_lbp = dfLbp;

        // Dual currency compute for totals if provided
        let totUsd = Number(orderData.total_usd || 0);
        let totLbp = Number(orderData.total_lbp || 0);
        if (totUsd > 0 && (!totLbp || totLbp === 0)) {
          totLbp = await usdToLbp(totUsd);
        } else if (totLbp > 0 && (!totUsd || totUsd === 0)) {
          totUsd = await lbpToUsd(totLbp);
        }
        order.total_usd = totUsd;
        order.total_lbp = totLbp;

        // Support third_party_id if provided
        const thirdPartyId = orderData.third_party_id || null;

        // Insert order - handle optional fields that may not exist in all schema versions
        const insertQuery = `
          INSERT INTO orders (
            order_ref, type, is_purchase, customer_phone, customer_name, customer_address,
            brand_name, client_id, voucher_code, deliver_method, third_party_name, third_party_id,
            third_party_fee_usd, third_party_fee_lbp, driver_id, driver_fee_usd, driver_fee_lbp,
            instant, notes, total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp,
            status, payment_status, latitude, longitude, location_text, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
          ) RETURNING *
        `;

        const values = [
          order.order_ref, order.type, order.is_purchase, order.customer_phone, order.customer_name,
          order.customer_address, order.brand_name, orderData.client_id || null, order.voucher_code, order.deliver_method,
          order.third_party_name, thirdPartyId, order.third_party_fee_usd, order.third_party_fee_lbp,
          order.driver_id, order.driver_fee_usd, order.driver_fee_lbp, order.instant, order.notes,
          order.total_usd, order.total_lbp, order.delivery_fee_usd, order.delivery_fee_lbp,
          order.status, order.payment_status, order.latitude, order.longitude,
          order.location_text, order.created_by
        ];

        const result = await client.query(insertQuery, values);
        const createdOrder = result.rows[0];
        
        // Calculate and update computed values
        const computed = computeDisplayedAmounts(createdOrder);
        await client.query(`
          UPDATE orders 
          SET computed_total_usd = $1, computed_total_lbp = $2
          WHERE id = $3
        `, [computed.computedTotalUSD, computed.computedTotalLBP, createdOrder.id]);
        
        createdOrders.push(createdOrder);

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
  const { getPool } = require('../config/database');
  const pool = getPool();
  const client = await pool.connect();
  
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

    // Update all orders - set status to 'assigned' only if current status is 'new'
    const updateQuery = `
      UPDATE orders 
      SET driver_id = $1, 
          status = CASE 
            WHEN status = 'new' THEN 'assigned' 
            ELSE status 
          END,
          updated_at = now()
      WHERE id = ANY($2)
      RETURNING id, order_ref, driver_id, status, customer_name
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
        google_location,
        COALESCE(client_type, 'BUSINESS') as client_type
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