const express = require('express');
const { query, run, getPool } = require('../config/database');
const database = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');
const { computeDisplayedAmounts } = require('../utils/computeDisplayedAmounts');
const {
  processOrderCashDeduction,
  processOrderCashCredit,
  shouldCashOutOnCreate
} = require('../utils/cashboxAtomicOperations');
const router = express.Router();

// NOTE: These functions are now replaced by processOrderCashDeduction and processOrderCashCredit
// in cashboxAtomicOperations.js which use proper atomic transactions

// Missing handlers to wrap atomic cashbox operations in a DB transaction
async function handleOrderCashDeduction(orderId, orderData, userId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await processOrderCashDeduction(client, orderId, orderData, userId);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function handleOrderPayment(orderId, orderData, userId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reason = orderData?.payment_status === 'paid' ? 'paid' : 'delivery';
    await processOrderCashCredit(client, orderId, orderData, userId, reason);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Removed duplicate local updateCashboxBalance; use cashboxAtomicOperations/mcp for atomic updates

// Helper function to calculate and update computed values for an order
async function updateOrderComputedValues(orderId) {
  try {
    const order = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order.length) return null;

    const orderData = order[0];
    const computed = computeDisplayedAmounts(orderData);

    await run(`
      UPDATE orders 
      SET computed_total_usd = ?, computed_total_lbp = ?
      WHERE id = ?
    `, [computed.computedTotalUSD, computed.computedTotalLBP, orderId]);

    return computed;
  } catch (error) {
    console.error('Error updating computed values for order:', orderId, error);
    throw error;
  }
}

// Get all orders with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '', 
      brand_name = '', 
      type = '', 
      driver_id = '',
      payment_status = '',
      from_date = '',
      to_date = '',
      date_from = '',
      date_to = '',
      search = '',
      q = '',
      delivery_mode = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (status) {
      if (String(status).startsWith('!')) {
        filterConditions.push(`o.status <> ?`);
        filterParams.push(String(status).slice(1));
      } else {
        filterConditions.push(`o.status = ?`);
        filterParams.push(status);
      }
    }

    const keyword = q || search || brand_name;
    if (keyword) {
      filterConditions.push(`(LOWER(o.brand_name) LIKE LOWER(?) OR LOWER(o.customer_name) LIKE LOWER(?) OR LOWER(o.order_ref) LIKE LOWER(?))`);
      filterParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (type) {
      filterConditions.push(`o.type = ?`);
      filterParams.push(type);
    }

    if (driver_id) {
      filterConditions.push(`o.driver_id = ?`);
      filterParams.push(driver_id);
    }

    if (payment_status) {
      filterConditions.push(`o.payment_status = ?`);
      filterParams.push(payment_status);
    }

    if (delivery_mode) {
      // Map frontend values to database values
      let dbValue = delivery_mode;
      if (delivery_mode === 'direct') {
        dbValue = 'in_house';
      }
      console.log(`🔍 Delivery mode filter: frontend="${delivery_mode}" → database="${dbValue}"`);
      filterConditions.push(`o.deliver_method = ?`);
      filterParams.push(dbValue);
    }

    const df = from_date || date_from;
    const dt = to_date || date_to;
    if (df) {
      filterConditions.push(`o.created_at >= ?`);
      filterParams.push(df);
    }

    if (dt) {
      filterConditions.push(`o.created_at <= ?`);
      filterParams.push(dt);
    }

    // Exclude orders that have been moved to history (they should only appear in order history)
    // Add condition to exclude moved_to_history = true orders
    if (filterConditions.length > 0) {
      filterConditions.push('(o.moved_to_history IS NULL OR o.moved_to_history = false)');
    } else {
      filterConditions.push('(o.moved_to_history IS NULL OR o.moved_to_history = false)');
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : 'WHERE (o.moved_to_history IS NULL OR o.moved_to_history = false)';

    console.log(`🔍 Final query: ${whereClause}`);
    console.log(`🔍 Query params:`, filterParams);

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM orders o ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;
    console.log(`🔍 Total count: ${totalCount}`);

    // Get orders with pagination
    const ordersQuery = `
      SELECT 
        o.*,
        COALESCE(o.computed_total_usd, 0)::numeric AS computed_total_usd,
        COALESCE(o.computed_total_lbp, 0)::bigint AS computed_total_lbp,
        COALESCE(o.accounting_cashed, false)::boolean AS accounting_cashed,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name,
        c.business_name as client_business_name,
        c.contact_person as client_contact_person,
        c.phone as client_phone,
        c.category as client_category
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const ordersResult = await query(ordersQuery, filterParams);

    res.json({
      success: true,
      data: ordersResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
});

// Get single order
// Constrain :id to digits to avoid conflicts with nested routes like /history
router.get('/:id(\\d+)', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }
    
    const orderQuery = `
      SELECT 
        o.*,
        COALESCE(o.computed_total_usd, 0) AS computed_total_usd,
        COALESCE(o.computed_total_lbp, 0) AS computed_total_lbp,
        COALESCE(o.accounting_cashed, false)::boolean AS accounting_cashed,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name,
        c.business_name as client_business_name,
        c.contact_person as client_contact_person,
        c.phone as client_phone,
        c.category as client_category
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.id = ?
    `;
    
    const result = await query(orderQuery, [numericId]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch order',
      error: error.message 
    });
  }
});

// Create new order
router.post('/', authenticateToken, async (req, res) => {
  let client = null;
  
  try {
    console.log('📝 Creating order request received');
    
    // Get database client connection
    try {
      // Use getPool() to ensure pool is initialized
      const pool = getPool();
      client = await pool.connect();
    } catch (connectError) {
      console.error('❌ Error connecting to database pool:', connectError);
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? connectError.message : 'Service unavailable'
      });
    }
    // Validate authentication
    if (!req.user || !req.user.id) {
      if (client) {
        try { client.release(); } catch (e) {}
      }
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await client.query('BEGIN');
    
    const {
      order_ref,
      brand_name,
      client_id,
      customer_name,
      customer_phone,
      customer_address,
      driver_id,
      type,
      deliver_method,
      status,
      payment_status,
      notes,
      total_usd,
      total_lbp,
      delivery_fee_usd,
      delivery_fee_lbp,
      third_party_fee_usd,
      third_party_fee_lbp,
      driver_fee_usd,
      driver_fee_lbp,
      is_purchase,
      third_party_id,
      delivery_country,
      delivery_region,
      delivery_sub_region
    } = req.body;

    if (!customer_name || !customer_phone) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('❌ Error rolling back transaction:', rollbackErr.message);
      }
      if (client) {
        try { client.release(); } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone are required'
      });
    }

    // Generate order reference if not provided or if it already exists
    let finalOrderRef = order_ref;
    try {
      if (!finalOrderRef) {
        finalOrderRef = await generateUniqueOrderRef(client);
      } else {
        // Check if the provided order_ref already exists (within transaction)
        const existingOrderResult = await client.query(
          'SELECT id FROM orders WHERE order_ref = $1',
          [finalOrderRef]
        );
        if (existingOrderResult.rows.length > 0) {
          // Generate a new unique order reference
          finalOrderRef = await generateUniqueOrderRef(client);
          console.log(`Order reference conflict detected, generated new ref: ${finalOrderRef}`);
        }
      }
    } catch (refError) {
      console.error('Error generating order reference:', refError);
      // Generate a simple fallback reference
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 7).toUpperCase();
      finalOrderRef = `ORD-${timestamp}-${random}`;
    }

    const orderData = {
      order_ref: finalOrderRef,
      brand_name: brand_name || '',
      client_id: client_id || null,
      customer_name,
      customer_phone,
      customer_address: customer_address || '',
      driver_id: driver_id || null,
      type: type || 'ecommerce',
      deliver_method: deliver_method || 'in_house',
      status: status || 'new',
      payment_status: payment_status || 'unpaid',
      notes: notes || '',
      total_usd: parseFloat(total_usd) || 0,
      total_lbp: parseInt(total_lbp) || 0,
      delivery_fee_usd: parseFloat(delivery_fee_usd) || 0,
      delivery_fee_lbp: parseInt(delivery_fee_lbp) || 0,
      third_party_fee_usd: parseFloat(third_party_fee_usd) || 0,
      third_party_fee_lbp: parseInt(third_party_fee_lbp) || 0,
      driver_fee_usd: parseFloat(driver_fee_usd) || 0,
      driver_fee_lbp: parseInt(driver_fee_lbp) || 0,
      is_purchase: is_purchase === true || is_purchase === 'true' || is_purchase === 1
    };

    // Add additional fields
    orderData.third_party_id = third_party_id || null;
    orderData.delivery_country = delivery_country || 'Lebanon';
    orderData.delivery_region = delivery_region || null;
    orderData.delivery_sub_region = delivery_sub_region || null;

    // Create order using direct SQL within transaction
    const insertResult = await client.query(
      `INSERT INTO orders (
        order_ref, brand_name, client_id, customer_name, customer_phone, customer_address,
        driver_id, type, deliver_method, status, payment_status, notes,
        total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp,
        third_party_fee_usd, third_party_fee_lbp, driver_fee_usd, driver_fee_lbp, is_purchase,
        third_party_id, delivery_country, delivery_region, delivery_sub_region,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, now(), now()
      ) RETURNING *`,
      [
        orderData.order_ref, orderData.brand_name, orderData.client_id, orderData.customer_name,
        orderData.customer_phone, orderData.customer_address, orderData.driver_id, orderData.type,
        orderData.deliver_method, orderData.status, orderData.payment_status, orderData.notes,
        orderData.total_usd, orderData.total_lbp, orderData.delivery_fee_usd, orderData.delivery_fee_lbp,
        orderData.third_party_fee_usd, orderData.third_party_fee_lbp, orderData.driver_fee_usd,
        orderData.driver_fee_lbp, orderData.is_purchase, orderData.third_party_id,
        orderData.delivery_country, orderData.delivery_region, orderData.delivery_sub_region,
        req.user.id
      ]
    );
    
    const createdOrder = insertResult.rows[0];
    if (!createdOrder || !createdOrder.id) {
      throw new Error('Failed to create order - no order returned from database');
    }

    // Calculate and update computed values
    let computed = { computedTotalUSD: orderData.total_usd || 0, computedTotalLBP: orderData.total_lbp || 0 };
    try {
      const { computeDisplayedAmounts } = require('../utils/computeDisplayedAmounts');
      computed = computeDisplayedAmounts({
        total_usd: orderData.total_usd,
        total_lbp: orderData.total_lbp,
        delivery_fee_usd: orderData.delivery_fee_usd,
        delivery_fee_lbp: orderData.delivery_fee_lbp,
        third_party_fee_usd: orderData.third_party_fee_usd,
        third_party_fee_lbp: orderData.third_party_fee_lbp,
        driver_fee_usd: orderData.driver_fee_usd,
        driver_fee_lbp: orderData.driver_fee_lbp,
        deliver_method: orderData.deliver_method,
        type: orderData.type
      });
    } catch (computeError) {
      console.warn('Error computing displayed amounts, using defaults:', computeError.message);
      // Use defaults if computation fails
    }
    
    try {
      await client.query(
        'UPDATE orders SET computed_total_usd = $1, computed_total_lbp = $2 WHERE id = $3',
        [computed.computedTotalUSD || orderData.total_usd || 0, computed.computedTotalLBP || orderData.total_lbp || 0, createdOrder.id]
      );
    } catch (updateError) {
      console.error('Error updating computed totals:', updateError);
      // Continue - this is not critical
    }

    // Handle cash account deductions using proper shouldCashOutOnCreate logic
    let shouldCashOut = false;
    let cashDeductionSuccess = false;
    let cashDeductionError = null;
    
    try {
      shouldCashOut = shouldCashOutOnCreate({
        type: orderData.type,
        payment_status: orderData.payment_status,
        is_purchase: orderData.is_purchase
      });
      
      if (shouldCashOut) {
        console.log(`💰 Attempting cash deduction for prepaid order ${createdOrder.order_ref}`, {
          orderId: createdOrder.id,
          type: orderData.type,
          payment_status: orderData.payment_status,
          is_purchase: orderData.is_purchase,
          total_usd: orderData.total_usd,
          total_lbp: orderData.total_lbp
        });
        
        try {
          await processOrderCashDeduction(client, createdOrder.id, createdOrder, req.user.id);
          cashDeductionSuccess = true;
          console.log(`✅ Cash deduction successful for prepaid order ${createdOrder.order_ref}`);
        } catch (deductionError) {
          cashDeductionError = deductionError;
          console.error('❌ Cash deduction failed, but order will be created:', {
            error: deductionError.message,
            stack: deductionError.stack,
            orderId: createdOrder.id,
            orderRef: createdOrder.order_ref,
            errorCode: deductionError.code,
            errorDetails: {
              constraint: deductionError.constraint,
              column: deductionError.column,
              table: deductionError.table
            }
          });
          // Don't throw - allow order creation to continue
          // The error is logged, and order can be manually adjusted later
        }
      }
    } catch (cashError) {
      cashDeductionError = cashError;
      console.error('❌ Error determining cash deduction need:', {
        error: cashError.message,
        stack: cashError.stack
      });
      // Log but don't fail the order creation
      console.warn('Continuing order creation despite cash logic error');
    }

    // Commit the transaction - order is created regardless of cashbox operation success
    try {
      await client.query('COMMIT');
    } catch (commitError) {
      console.error('❌ Error committing transaction:', {
        error: commitError.message,
        stack: commitError.stack
      });
      // If commit fails, we need to rollback and return error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('❌ Error during rollback:', rollbackErr.message);
      }
      if (client) {
        try { client.release(); } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to commit order creation',
        error: process.env.NODE_ENV === 'development' ? commitError.message : 'Internal server error'
      });
    }
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-created', {
        orderRef: createdOrder.order_ref,
        id: createdOrder.id,
        clientId: createdOrder.client_id
      });
      
      if (shouldCashOut) {
        io.emit('cashbox-update', {
          orderRef: createdOrder.order_ref,
          action: 'created'
        });
      }
    }

    // Release database client (will be done in finally block)
    // Don't release here to ensure it happens even if response fails

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { 
        ...createdOrder, 
        computed_total_usd: computed.computedTotalUSD, 
        computed_total_lbp: computed.computedTotalLBP 
      },
      warnings: cashDeductionError ? [{
        type: 'cashbox_deduction_failed',
        message: 'Order created successfully, but cashbox deduction failed. Please review manually.',
        error: process.env.NODE_ENV === 'development' ? cashDeductionError.message : undefined
      }] : []
    });
  } catch (error) {
    // Log full error details
    console.error('❌ Error creating order:', {
      message: error.message,
      stack: error.stack,
      body: JSON.stringify(req.body).substring(0, 200),
      userId: req.user?.id || 'unknown'
    });
    
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Rollback error:', rollbackError.message);
    }
    
    // Ensure client is always released
    try {
      client.release();
    } catch (releaseError) {
      console.error('❌ Error releasing client:', releaseError.message);
    }
    
    // Send error response
    const errorMessage = error.message || 'Unknown error occurred';
    const friendlyMessage = errorMessage.includes('does not exist') 
      ? 'Database schema error - please contact administrator'
      : errorMessage.includes('foreign key')
      ? 'Invalid reference data provided'
      : 'Failed to create order';
    
    // Only send error response if not already sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: friendlyMessage,
        error: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error'
      });
    }
  } finally {
    // Always release the database client, even if there was an error
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Error releasing database client in finally block:', releaseError.message);
      }
    }
  }
});

// Update order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    // Convert boolean fields
    if (updateData.is_purchase !== undefined) {
      updateData.is_purchase = updateData.is_purchase ? 1 : 0;
    }
    if (updateData.instant !== undefined) {
      updateData.instant = updateData.instant ? 1 : 0;
    }

    // Use MCP layer for update
    await mcp.update('orders', id, updateData);

    // Calculate and update computed values
    await updateOrderComputedValues(id);

    // Fetch the updated order
    const orderQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `;
    
    const orderResult = await query(orderQuery, [id]);

    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:updated', orderResult[0]);
    } catch {}

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: orderResult[0]
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order',
      error: error.message 
    });
  }
});

// Update order status and payment_status
router.patch('/:id', authenticateToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, payment_status, driver_id, fee_usd, fee_lbp, delivery_fee_usd, delivery_fee_lbp, notes, is_purchase } = req.body;

    // Validate input
    if (!status && !payment_status) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'At least one field (status or payment_status) must be provided' 
      });
    }

    // Fetch current order with FOR UPDATE lock
    const currentOrderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (currentOrderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const currentOrder = currentOrderResult.rows[0];

    // CRITICAL VALIDATION: Check if driver is assigned before allowing certain status/payment_status updates
    // Determine the final driver_id (from request body or current order)
    const finalDriverId = driver_id !== undefined ? driver_id : currentOrder.driver_id;
    
    // Statuses that require driver assignment
    const statusesRequiringDriver = ['delivered', 'in_transit', 'picked_up', 'in_transit', 'picked up', 'picked-up'];
    const normalizedStatus = status ? String(status).toLowerCase().trim() : null;
    
    // Payment statuses that require driver assignment
    const paymentStatusesRequiringDriver = ['paid', 'refunded'];
    const normalizedPaymentStatus = payment_status ? String(payment_status).toLowerCase().trim() : null;
    
    // Check if trying to set status that requires driver
    if (normalizedStatus && statusesRequiringDriver.includes(normalizedStatus)) {
      if (!finalDriverId || finalDriverId === null) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cannot set order status to '${status}' without a driver assigned. Please assign a driver first.`
        });
      }
    }
    
    // Check if trying to set payment_status that requires driver
    if (normalizedPaymentStatus && paymentStatusesRequiringDriver.includes(normalizedPaymentStatus)) {
      if (!finalDriverId || finalDriverId === null) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cannot set payment status to '${payment_status}' without a driver assigned. Please assign a driver first.`
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (status) updateData.status = status;
    if (payment_status) updateData.payment_status = payment_status;
    if (driver_id !== undefined) updateData.driver_id = driver_id;
    if (notes !== undefined) updateData.notes = notes;
    if (fee_usd !== undefined) updateData.fee_usd = Number(fee_usd) || 0;
    if (fee_lbp !== undefined) updateData.fee_lbp = Number(fee_lbp) || 0;
    if (delivery_fee_usd !== undefined) updateData.delivery_fee_usd = Number(delivery_fee_usd) || 0;
    if (delivery_fee_lbp !== undefined) updateData.delivery_fee_lbp = Number(delivery_fee_lbp) || 0;
    if (is_purchase !== undefined) updateData.is_purchase = is_purchase === true || is_purchase === 'true' || is_purchase === 1;
    
    // Set delivered_at and completed_at if status becomes delivered or completed
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Build SQL update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updateData)) {
      updateFields.push(`${key} = $${paramIndex}`);
      updateValues.push(value);
      paramIndex++;
    }
    
    updateFields.push(`updated_at = now()`);
    
    if (updateFields.length > 0) {
      updateValues.push(id);
      await client.query(
        `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    // Fetch updated order
    const updatedOrderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    const updatedOrder = updatedOrderResult.rows[0];
    
    // Handle cash account deductions if payment status changes to paid (for prepaid) or is_purchase/go-to-market
    const shouldCashOut = shouldCashOutOnCreate({
      type: updatedOrder.type,
      payment_status: updatedOrder.payment_status,
      is_purchase: updatedOrder.is_purchase
    });
    
    if (shouldCashOut && !currentOrder.cashbox_applied_on_create) {
      await processOrderCashDeduction(client, id, updatedOrder, req.user.id);
    }

    // Handle cash additions when order status becomes delivered AND payment_status is paid (credit once)
    // For prepaid orders: restore the cash that was deducted on creation
    const isStatusDelivered = status === 'delivered' || updatedOrder.status === 'delivered';
    const isPaymentPaid = payment_status === 'paid' || updatedOrder.payment_status === 'paid';
    
    if (isStatusDelivered && isPaymentPaid && !currentOrder.cashbox_applied_on_delivery) {
      // Credit cashbox - this restores money for prepaid orders and adds money for regular orders
      await processOrderCashCredit(client, id, updatedOrder, req.user.id, 'delivery');
    }

    // Check if order should be moved to history
    // When order status is "completed", check if:
    // 1. Payment status is "paid"
    // 2. Order has been cashed out (accounting_cashed = true)
    // If both conditions are met, automatically move to history
    // This handles:
    // - Status changed to "completed" when already paid and cashed
    // - Payment status changed to "paid" when already completed and cashed
    // - Accounting cashed after order is completed and paid
    const isStatusCompleted = status === 'completed' || updatedOrder.status === 'completed';
    const updatedPaymentStatus = String(updatedOrder.payment_status || '').toLowerCase().trim();
    const isPaymentStatusPaid = updatedPaymentStatus === 'paid';
    const isAccountingCashed = updatedOrder.accounting_cashed === true;
    
    // Check if order should be moved to history
    if (isStatusCompleted && isPaymentStatusPaid && isAccountingCashed) {
      // Order is completed, paid, and cashed out - move to history
      if (!updatedOrder.moved_to_history) {
        await client.query(
          `UPDATE orders SET moved_to_history = true, moved_at = NOW() WHERE id = $1`,
          [id]
        );
        console.log(`✅ Order ${id} (${updatedOrder.order_ref}) automatically moved to history: completed + paid + cashed out`);
      }
    }

    await client.query('COMMIT');
    
    // Fetch full order details for response
    const orderResult = await client.query(
      `SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = $1`,
      [id]
    );

    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-update', {
        orderRef: updatedOrder.order_ref,
        id: Number(id),
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status,
        driverId: updatedOrder.driver_id
      });
      
      if (status === 'delivered') {
        io.emit('cashbox-update', {
          orderRef: updatedOrder.order_ref,
          action: 'delivered'
        });
      }
      
      if (payment_status === 'paid') {
        io.emit('payment-update', {
          orderRef: updatedOrder.order_ref,
          id: Number(id),
          amount_usd: updatedOrder.total_usd,
          amount_lbp: updatedOrder.total_lbp,
          payment_status: 'paid'
        });
      }
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: orderResult.rows[0]
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order status',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// Assign driver to order
router.post('/:id/assign-driver', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Driver ID is required' 
      });
    }

    // Update order with driver assignment
    await mcp.update('orders', id, { 
      driver_id,
      status: 'assigned',
      updated_at: new Date().toISOString()
    });

    // Fetch updated order
    const orderQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `;
    
    const orderResult = await query(orderQuery, [id]);

    // Emit update event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:updated', orderResult[0]);
    } catch {}

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      data: orderResult[0]
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to assign driver',
      error: error.message 
    });
  }
});

// Complete order: mark as completed and create ledger entries
router.post('/:id/complete', authenticateToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status = 'completed', payment_status = 'paid' } = req.body;

    // Fetch order with lock
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const order = orderResult.rows[0];

    // Update status, payment_status, and completed_at
    await client.query(
      `UPDATE orders 
       SET status = $1, payment_status = $2, completed_at = now(), delivered_at = CASE WHEN $1 = 'delivered' THEN now() ELSE delivered_at END, updated_at = now()
       WHERE id = $3`,
      [status, payment_status, id]
    );

    // Fetch updated order
    const updatedOrderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    const updatedOrder = updatedOrderResult.rows[0];

    // Add cash to cashbox when order is delivered and paid (credit once)
    if ((status === 'delivered' || status === 'completed') && payment_status === 'paid') {
      if (!order.cashbox_applied_on_delivery) {
        await processOrderCashCredit(client, id, updatedOrder, req.user.id, 'delivery');
      }
    }

    // Ledger: credit delivery fee to company
    if ((updatedOrder.delivery_fee_usd || 0) > 0 || (updatedOrder.delivery_fee_lbp || 0) > 0) {
      await client.query(
        `INSERT INTO transactions (tx_type, amount_usd, amount_lbp, actor_type, actor_id, 
         debit_account, credit_account, description, order_id, category, direction, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        ['delivery_fee', updatedOrder.delivery_fee_usd || 0, updatedOrder.delivery_fee_lbp || 0,
         'client', null, 'revenue', 'cash_account', 'Order delivery fee', id,
         'delivery', 'credit', req.user.id]
      );
    }

    // Ledger: third-party payout if any for third_party mode
    if (updatedOrder.deliver_method === 'third_party' && ((updatedOrder.third_party_fee_usd || 0) > 0 || (updatedOrder.third_party_fee_lbp || 0) > 0)) {
      await client.query(
        `INSERT INTO transactions (tx_type, amount_usd, amount_lbp, actor_type, actor_id, 
         debit_account, credit_account, description, order_id, category, direction, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        ['third_party_payout', updatedOrder.third_party_fee_usd || 0, updatedOrder.third_party_fee_lbp || 0,
         'third_party', updatedOrder.third_party_id || null, 'cash_account', 'third_party_payable',
         'Third-party payout', id, 'payout', 'debit', req.user.id]
      );
    }

    // Optional: driver payout
    if ((updatedOrder.driver_fee_usd || 0) > 0 || (updatedOrder.driver_fee_lbp || 0) > 0) {
      await client.query(
        `INSERT INTO transactions (tx_type, amount_usd, amount_lbp, actor_type, actor_id, 
         debit_account, credit_account, description, order_id, category, direction, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        ['driver_payout', updatedOrder.driver_fee_usd || 0, updatedOrder.driver_fee_lbp || 0,
         'driver', updatedOrder.driver_id || null, 'cash_account', 'driver_payable',
         'Driver payout', id, 'payout', 'debit', req.user.id]
      );
    }

    // Append order history
    try {
      await client.query(
        `INSERT INTO order_history (order_id, action, actor, details, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [id, 'complete', req.user?.id ? String(req.user.id) : 'system', JSON.stringify({ status, payment_status })]
      );
    } catch (err) {
      console.warn('Could not create order history entry:', err);
    }

    await client.query('COMMIT');

    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-update', {
        orderRef: updatedOrder.order_ref,
        id: Number(id),
        status: status,
        payment_status: payment_status
      });
      
      if (status === 'delivered' || status === 'completed') {
        io.emit('cashbox-update', {
          orderRef: updatedOrder.order_ref,
          action: 'completed'
        });
      }
    }

    res.json({
      success: true,
      message: 'Order completed and ledger entries created',
      data: updatedOrder
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Error completing order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to complete order',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// Cancel order: mark as cancelled and move to history
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    // Fetch order
    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update status to cancelled and set completed_at
    await mcp.update('orders', id, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });

    // Create transaction entry for cancellation
    await mcp.create('transactions', {
      tx_type: 'order_cancellation',
      amount_usd: order.total_usd || 0,
      amount_lbp: order.total_lbp || 0,
      actor_type: 'system',
      actor_id: null,
      description: reason,
      order_id: id,
      category: 'cancellation',
      direction: 'debit',
      created_by: req.user.id
    });

    // Emit update event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:updated', { id: Number(id), status: 'cancelled' });
    } catch {}

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel order',
      error: error.message 
    });
  }
});

// Delete order
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Delete order
    await mcp.delete('orders', id);

    // Emit delete event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:deleted', { id: Number(id) });
    } catch {}

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete order',
      error: error.message 
    });
  }
});

// Helper function to get cashbox balance
async function getCashboxBalance() {
  try {
    const result = await query('SELECT balance_usd, balance_lbp FROM cashbox WHERE id = 1');
    return result[0] || { balance_usd: 0, balance_lbp: 0 };
  } catch (error) {
    console.error('Error getting cashbox balance:', error);
    return { balance_usd: 0, balance_lbp: 0 };
  }
}

// Helper function to update cashbox balance
async function updateCashboxBalance(usdDelta, lbpDelta) {
  try {
    const currentBalance = await getCashboxBalance();
    const newBalanceUsd = currentBalance.balance_usd + usdDelta;
    const newBalanceLbp = currentBalance.balance_lbp + lbpDelta;
    
    await mcp.update('cashbox', 1, {
      balance_usd: newBalanceUsd,
      balance_lbp: newBalanceLbp
    });
    
    return { balance_usd: newBalanceUsd, balance_lbp: newBalanceLbp };
  } catch (error) {
    console.error('Error updating cashbox balance:', error);
    throw error;
  }
}

// Helper function to generate order reference
function generateOrderRef() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

// Helper function to generate unique order reference with database check
async function generateUniqueOrderRef(dbClient = null) {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderRef = `${timestamp}-${random}`;
    
    try {
      let existingOrder;
      if (dbClient) {
        // Use transaction client for PostgreSQL
        const result = await dbClient.query('SELECT id FROM orders WHERE order_ref = $1', [orderRef]);
        existingOrder = result.rows;
      } else {
        // Fallback to pool query
        const pool = getPool();
        const result = await pool.query('SELECT id FROM orders WHERE order_ref = $1', [orderRef]);
        existingOrder = result.rows;
      }
      
      if (!existingOrder || existingOrder.length === 0) {
        return orderRef;
      }
    } catch (error) {
      console.error('Error checking order reference uniqueness:', error);
      // If there's an error checking, return the generated ref anyway
      return orderRef;
    }
    
    attempts++;
  }
  
  // If we've exhausted attempts, generate one with additional randomness
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const random1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const random2 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${timestamp}-${random1}-${random2}`;
}

// Customer autocomplete/search - search existing customers from orders
router.get('/customers/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchQuery = `
      SELECT DISTINCT
        customer_name as name,
        customer_phone as phone,
        customer_address as address
      FROM orders 
      WHERE LOWER(customer_name) LIKE LOWER($1) 
         OR LOWER(customer_phone) LIKE LOWER($1)
         OR LOWER(customer_address) LIKE LOWER($1)
      ORDER BY 
        CASE 
          WHEN LOWER(customer_name) LIKE LOWER($1) THEN 1
          WHEN LOWER(customer_phone) LIKE LOWER($1) THEN 2
          ELSE 3
        END,
        customer_name
      LIMIT 10
    `;

    const results = await query(searchQuery, [`%${q}%`]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search customers',
      error: error.message
    });
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
        category,
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

// Bulk update order status
router.patch('/bulk/status', authenticateToken, async (req, res) => {
  try {
    const { orderIds, status, paymentStatus } = req.body;
    const userId = req.user.id;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order IDs array is required' 
      });
    }

    if (!status && !paymentStatus) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either status or paymentStatus must be provided' 
      });
    }

    // Validate status values
    const validStatuses = ['new', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled', 'returned'];
    const validPaymentStatuses = ['unpaid', 'partial', 'paid', 'prepaid', 'refunded'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` 
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (paymentStatus) {
      updateFields.push('payment_status = ?');
      updateValues.push(paymentStatus);
    }

    updateFields.push('updated_at = now()');
    updateValues.push(...orderIds);

    const placeholders = orderIds.map(() => '?').join(',');
    const queryString = `
      UPDATE orders 
      SET ${updateFields.join(', ')}
      WHERE id IN (${placeholders})
    `;

    const result = await run(queryString, updateValues);

    // Handle delivered status - update driver/third-party balances
    if (status === 'delivered') {
      for (const orderId of orderIds) {
        const order = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (order.length) {
          const o = order[0];
          
          // Update driver balance if in-house delivery
          if (o.deliver_method === 'in_house' && o.driver_id && o.driver_fee_usd > 0) {
            await run(`
              UPDATE drivers 
              SET account_balance_usd = account_balance_usd + ?, 
                  account_balance_lbp = account_balance_lbp + ?
              WHERE id = ?
            `, [o.driver_fee_usd, o.driver_fee_lbp, o.driver_id]);
          }

          // Update third party balance if third party delivery
          if (o.deliver_method === 'third_party' && o.third_party_fee_usd > 0) {
            // Find or create third party
            let thirdParty = await query('SELECT id FROM third_parties WHERE name = ?', [o.third_party_name]);
            if (!thirdParty.length) {
              const result = await run('INSERT INTO third_parties (name) VALUES (?)', [o.third_party_name]);
              thirdParty = [{ id: result.id }];
            }

            await run(`
              UPDATE third_parties 
              SET old_balance_usd = old_balance_usd + ?, 
                  old_balance_lbp = old_balance_lbp + ?
              WHERE id = ?
            `, [o.third_party_fee_usd, o.third_party_fee_lbp, thirdParty[0].id]);
          }

          // Update order delivered date
          await run('UPDATE orders SET completed_at = now() WHERE id = ?', [orderId]);
        }
      }
    }

    res.json({ 
      success: true, 
      message: `Successfully updated ${orderIds.length} orders`,
      updatedCount: orderIds.length
    });

  } catch (error) {
    console.error('Error bulk updating order status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Bulk update payment status for third-party orders
router.patch('/bulk/payment-status', authenticateToken, async (req, res) => {
  try {
    const { orderIds, paymentStatus } = req.body;
    const userId = req.user.id;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order IDs array is required' 
      });
    }

    if (!paymentStatus) {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment status is required' 
      });
    }

    const validPaymentStatuses = ['unpaid', 'partial', 'paid', 'prepaid', 'refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` 
      });
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const query = `
      UPDATE orders 
      SET payment_status = ?, updated_at = now()
      WHERE id IN (${placeholders})
    `;

    const updateValues = [paymentStatus, ...orderIds];
    const result = await run(query, updateValues);

    res.json({ 
      success: true, 
      message: `Successfully updated payment status for ${orderIds.length} order(s)`,
      updatedCount: orderIds.length
    });

  } catch (error) {
    console.error('Error bulk updating payment status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// CSV export for orders with same filters
router.get('/export/csv', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { 
      status = '', 
      brand_name = '', 
      type = '', 
      driver_id = '',
      payment_status = '',
      from_date = '',
      to_date = '',
      date_from = '',
      date_to = '',
      search = '',
      q = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Status filter
    if (status) {
      if (status === '!cancelled') {
        whereClause += ' AND status != ?';
        params.push('cancelled');
      } else {
        whereClause += ' AND status = ?';
        params.push(status);
      }
    }

    // Brand name filter
    if (brand_name) {
      whereClause += ' AND brand_name LIKE ?';
      params.push(`%${brand_name}%`);
    }

    // Type filter
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    // Driver filter
    if (driver_id) {
      whereClause += ' AND driver_id = ?';
      params.push(driver_id);
    }

    // Payment status filter
    if (payment_status) {
      whereClause += ' AND payment_status = ?';
      params.push(payment_status);
    }

    // Date filters
    const fromDate = from_date || date_from;
    const toDate = to_date || date_to;
    
    if (fromDate) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(toDate);
    }

    // Search filter
    const searchTerm = search || q;
    if (searchTerm) {
      whereClause += ' AND (order_ref LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_address LIKE ? OR brand_name LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Build ORDER BY clause
    const validSortColumns = ['created_at', 'order_ref', 'customer_name', 'total_usd', 'total_lbp', 'status', 'payment_status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${sortColumn} ${sortDirection}`;

  const sql = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        c.business_name as client_business_name,
        c.client_name as client_client_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.client_id = c.id
      ${whereClause}
      ${orderClause}
    `;

    const orders = await query(sql, params);

    // Generate CSV content
    let csv = 'Reference,Client,Customer Name,Customer Phone,Customer Address,Order Type,Delivery Method,Total USD,Total LBP,Delivery Fee USD,Delivery Fee LBP,Third Party Fee USD,Third Party Fee LBP,Driver Fee USD,Driver Fee LBP,Payment Status,Order Status,Date,Cashed Out\n';
    
    orders.forEach(order => {
      const row = [
        order.order_ref || '',
        order.brand_name || '',
        order.customer_name || '',
        order.customer_phone || '',
        order.customer_address || '',
        order.type || '',
        order.deliver_method || '',
        order.total_usd || 0,
        order.total_lbp || 0,
        order.delivery_fee_usd || 0,
        order.delivery_fee_lbp || 0,
        order.third_party_fee_usd || 0,
        order.third_party_fee_lbp || 0,
        order.driver_fee_usd || 0,
        order.driver_fee_lbp || 0,
        order.payment_status || '',
        order.status || '',
        order.created_at || '',
        order.accounting_cashed ? 'Yes' : 'No'
      ];
      csv += row.map(field => `"${field}"`).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Error exporting orders CSV:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
