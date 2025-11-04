const express = require('express');
const { query, run, getPool } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const { 
  processOrderCashDeduction, 
  processOrderCashCredit, 
  shouldCashOutOnCreate 
} = require('../utils/cashboxAtomicOperations');

const router = express.Router();

/**
 * CREATE ORDER with Atomic Cashbox Operations
 * Implements prepaid and go-to-market cash rules
 */
router.post('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
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
      is_purchase
    } = req.body;

    if (!customer_name || !customer_phone) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone are required'
      });
    }

    // Generate order reference
    let finalOrderRef = order_ref;
    if (!finalOrderRef) {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      finalOrderRef = `ORD-${timestamp}-${random}`;
    }

    // Build order data
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
      is_purchase: is_purchase || (type === 'go_to_market'),
      cashbox_applied_on_create: false,
      cashbox_applied_on_delivery: false,
      cashbox_applied_on_paid: false
    };

    // Create order
    const insertQuery = `
      INSERT INTO orders (
        order_ref, brand_name, client_id, customer_name, customer_phone, customer_address,
        driver_id, type, deliver_method, status, payment_status, notes,
        total_usd, total_lbp, delivery_fee_usd, delivery_fee_lbp,
        third_party_fee_usd, third_party_fee_lbp, driver_fee_usd, driver_fee_lbp,
        is_purchase, created_by, cashbox_applied_on_create
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22, $23
      ) RETURNING *
    `;
    
    const orderResult = await client.query(insertQuery, [
      orderData.order_ref, orderData.brand_name, orderData.client_id,
      orderData.customer_name, orderData.customer_phone, orderData.customer_address,
      orderData.driver_id, orderData.type, orderData.deliver_method,
      orderData.status, orderData.payment_status, orderData.notes,
      orderData.total_usd, orderData.total_lbp, orderData.delivery_fee_usd,
      orderData.delivery_fee_lbp, orderData.third_party_fee_usd,
      orderData.third_party_fee_lbp, orderData.driver_fee_usd, orderData.driver_fee_lbp,
      orderData.is_purchase, req.user.id, orderData.cashbox_applied_on_create
    ]);
    
    const createdOrder = orderResult.rows[0];
    const orderId = createdOrder.id;

    // Check if we should deduct cash on creation
    if (shouldCashOutOnCreate(orderData)) {
      await processOrderCashDeduction(client, orderId, orderData, req.user.id);
    }

    await client.query('COMMIT');
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('order-update', {
        orderRef: orderData.order_ref,
        status: orderData.status,
        payment_status: orderData.payment_status,
        type: orderData.type
      });
      
      io.emit('cashbox-update', {
        orderRef: orderData.order_ref,
        action: 'created'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: createdOrder
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * UPDATE ORDER with Atomic Cashbox Operations
 * Handles delivered status and payment status changes
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, payment_status, driver_id, notes } = req.body;

    // Fetch current order with lock
    const currentOrderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1', [id]
    );
    
    if (currentOrderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
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
    
    updateData.updated_at = new Date().toISOString();
    
    // Set delivered_at if status becomes delivered
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }
    
    // Set completed_at if status becomes completed
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Update order
    const updateFields = Object.keys(updateData).map((key, index) => `${key} = $${index + 1}`);
    const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${updateFields.length + 1} RETURNING *`;
    
    await client.query(
      updateQuery,
      [...Object.values(updateData), id]
    );

    const updatedOrder = { ...currentOrder, ...updateData };

    // Process cash credit when order becomes delivered
    if (status === 'delivered' && !currentOrder.cashbox_applied_on_delivery) {
      await processOrderCashCredit(client, id, updatedOrder, req.user.id, 'delivery');
    }

    // Process cash credit when order becomes paid
    if (payment_status === 'paid' && !currentOrder.cashbox_applied_on_paid) {
      await processOrderCashCredit(client, id, updatedOrder, req.user.id, 'paid');
    }

    await client.query('COMMIT');
    
    // Fetch full updated order for response
    const fullOrderResult = await client.query(
      `SELECT o.*, d.full_name as driver_name, u.full_name as created_by_name
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
        orderRef: currentOrder.order_ref,
        status: status || currentOrder.status,
        payment_status: payment_status || currentOrder.payment_status,
        driverName: fullOrderResult.rows[0].driver_name
      });
      
      if (status === 'delivered') {
        io.emit('cashbox-update', {
          orderRef: currentOrder.order_ref,
          action: 'delivered'
        });
      }
      
      if (payment_status === 'paid') {
        io.emit('payment-update', {
          orderRef: currentOrder.order_ref,
          action: 'paid'
        });
      }
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: fullOrderResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating order:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

