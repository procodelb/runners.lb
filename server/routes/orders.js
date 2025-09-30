const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');
const router = express.Router();

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
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (status) {
      filterConditions.push(`o.status = ?`);
      filterParams.push(status);
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

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM orders o ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get orders with pagination
    const ordersQuery = `
      SELECT 
        o.*,
        COALESCE(o.computed_total_usd, 0) AS computed_total_usd,
        COALESCE(o.computed_total_lbp, 0) AS computed_total_lbp,
        COALESCE(o.accounting_cashed, 0) AS accounting_cashed,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
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
        COALESCE(o.accounting_cashed, 0) AS accounting_cashed,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
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
  try {
    const {
      order_ref,
      type = 'ecommerce',
      order_type = 'ecommerce',
      is_purchase = false,
      customer_phone,
      customer_name,
      customer_address,
      deliver_to, // Frontend field name
      brand_name,
      client,
      client_name,
      voucher_code,
      voucher, // Frontend field name
      deliver_method = 'in_house',
      delivery_type = 'direct',
      delivery_mode = 'direct',
      third_party_name,
      third_party_fee_usd = 0,
      third_party_fee_lbp = 0,
      third_party_fees_usd = 0, // Frontend field name
      third_party_fees_lbp = 0, // Frontend field name
      driver_id,
      driver_fee_usd = 0,
      driver_fee_lbp = 0,
      fees_usd = 0, // Frontend field name
      fees_lbp = 0, // Frontend field name
      fee_usd = 0,
      fee_lbp = 0,
      instant = false,
      notes,
      order_note, // Frontend field name
      total_usd = 0,
      total_lbp = 0,
      status = 'new',
      payment_status = 'unpaid',
      prepaid_status = 'unpaid',
      external_id,
      // New delivery location fields
      delivery_country = 'Lebanon',
      delivery_region,
      delivery_sub_region,
      // Google Maps fields
      latitude,
      longitude,
      location_text
    } = req.body;

    // Basic validation
    if (!customer_name && !deliver_to) {
      return res.status(400).json({ success: false, message: 'customer_name is required' });
    }

    // Generate order reference if not provided
    const finalOrderRef = order_ref || generateOrderRef();
    const finalType = type || order_type || 'ecommerce';
    
    // Map frontend fields to backend fields
    const finalCustomerName = customer_name || deliver_to || '';
    const finalBrandOrClient = client || client_name || brand_name || '';
    const finalVoucherCode = voucher_code || voucher || '';
    const finalNotes = notes || order_note || '';
    const finalTotalUsd = total_usd || fees_usd || 0;
    const finalTotalLbp = total_lbp || fees_lbp || 0;
    const finalThirdPartyFeeUsd = third_party_fee_usd || third_party_fees_usd || 0;
    const finalThirdPartyFeeLbp = third_party_fee_lbp || third_party_fees_lbp || 0;
    const finalFeeUsd = fee_usd || fees_usd || 0;
    const finalFeeLbp = fee_lbp || fees_lbp || 0;
    const finalDeliveryMode = delivery_mode || delivery_type || 'direct';

    // Look up delivery price if location is provided
    let deliveryPriceId = null;
    let deliveryFeeLbp = finalFeeLbp;
    let deliveryFeeUsd = finalFeeUsd;

    if (delivery_region) {
      try {
        let priceQuery = `
          SELECT * FROM delivery_prices 
          WHERE country = ? AND region = ? AND is_active = 1
        `;
        const priceParams = [delivery_country, delivery_region];

        if (delivery_sub_region) {
          priceQuery += ` AND sub_region = ?`;
          priceParams.push(delivery_sub_region);
        } else {
          priceQuery += ` AND sub_region IS NULL`;
        }

        priceQuery += ` ORDER BY created_at DESC LIMIT 1`;

        const priceResult = await query(priceQuery, priceParams);

        if (priceResult.length > 0) {
          const deliveryPrice = priceResult[0];
          deliveryPriceId = deliveryPrice.id;
          deliveryFeeLbp = deliveryPrice.price_lbp;
          deliveryFeeUsd = deliveryPrice.price_usd;
        } else if (delivery_sub_region) {
          // Try without sub_region if no exact match found
          const fallbackQuery = `
            SELECT * FROM delivery_prices 
            WHERE country = ? AND region = ? AND sub_region IS NULL AND is_active = 1
            ORDER BY created_at DESC LIMIT 1
          `;
          const fallbackResult = await query(fallbackQuery, [delivery_country, delivery_region]);
          if (fallbackResult.length > 0) {
            const deliveryPrice = fallbackResult[0];
            deliveryPriceId = deliveryPrice.id;
            deliveryFeeLbp = deliveryPrice.price_lbp;
            deliveryFeeUsd = deliveryPrice.price_usd;
          }
        }
      } catch (error) {
        console.error('Error looking up delivery price:', error.stack || error);
        // Continue with manual fees if lookup fails
      }
    }

    // Use MCP layer for order creation
    const orderData = {
      order_ref: finalOrderRef,
      type: finalType,
      is_purchase: is_purchase ? 1 : 0,
      customer_phone: customer_phone || '',
      customer_name: finalCustomerName,
      customer_address: customer_address || '',
      brand_name: finalBrandOrClient,
      voucher_code: finalVoucherCode,
      deliver_method: deliver_method,
      delivery_mode: finalDeliveryMode,
      third_party_name: third_party_name || '',
      third_party_fee_usd: finalThirdPartyFeeUsd,
      third_party_fee_lbp: finalThirdPartyFeeLbp,
      driver_id: driver_id || null,
      driver_fee_usd: driver_fee_usd || 0,
      driver_fee_lbp: driver_fee_lbp || 0,
      instant: instant ? 1 : 0,
      notes: finalNotes,
      fee_usd: finalFeeUsd,
      fee_lbp: finalFeeLbp,
      total_usd: finalTotalUsd,
      total_lbp: finalTotalLbp,
      delivery_fee_usd: deliveryFeeUsd,
      delivery_fee_lbp: deliveryFeeLbp,
      delivery_country: delivery_country,
      delivery_region: delivery_region || null,
      delivery_sub_region: delivery_sub_region || null,
      delivery_price_id: deliveryPriceId,
      status: status,
      payment_status: payment_status,
      prepaid_status: prepaid_status === true || prepaid_status === 'prepaid' ? 1 : 0,
      latitude: latitude || null,
      longitude: longitude || null,
      location_text: location_text || '',
      external_id: external_id || null,
      created_by: req.user.id
    };

    // Coerce numeric fields defensively
    const numericKeys = [
      'third_party_fee_usd','third_party_fee_lbp','driver_fee_usd','driver_fee_lbp',
      'fee_usd','fee_lbp','total_usd','total_lbp','delivery_fee_usd','delivery_fee_lbp'
    ];
    for (const k of numericKeys) {
      const raw = orderData[k];
      const cleaned = typeof raw === 'string' ? raw.replace(/,/g, '').trim() : raw;
      const isInt = /_lbp$/.test(k);
      const num = Number(cleaned);
      orderData[k] = Number.isFinite(num) ? (isInt ? Math.round(num) : Math.round(num * 100) / 100) : 0;
    }

    const result = await mcp.create('orders', orderData);

    // Compute and persist displayed totals on the newly created order
    try {
      const { computeDisplayedAmounts } = require('../utils/computeDisplayedAmounts');
      const computed = computeDisplayedAmounts({
        total_usd: orderData.total_usd,
        total_lbp: orderData.total_lbp,
        delivery_fee_usd: orderData.delivery_fee_usd,
        delivery_fee_lbp: orderData.delivery_fee_lbp,
        third_party_fee_usd: orderData.third_party_fee_usd,
        third_party_fee_lbp: orderData.third_party_fee_lbp,
        driver_fee_usd: orderData.driver_fee_usd,
        driver_fee_lbp: orderData.driver_fee_lbp,
        deliver_method: orderData.deliver_method,
        type: orderData.type,
        order_type: orderData.type,
        delivery_mode: orderData.delivery_mode
      });
      await mcp.update('orders', result.id, {
        computed_total_usd: computed.computedTotalUSD,
        computed_total_lbp: computed.computedTotalLBP
      });
    } catch (e) {
      console.warn('computeDisplayedAmounts failed:', e.message);
    }

    // Create cashbox reservation for go-to-market orders
    try {
      if (finalType === 'go_to_market') {
        await mcp.create('cashbox_reservations', {
          order_id: result.id,
          amount_usd: orderData.total_usd || 0,
          amount_lbp: orderData.total_lbp || 0
        });
      }
    } catch (e) {
      console.warn('cashbox reservation create failed:', e.message);
    }

    // Fetch the created order with joins
    const orderQuery = `
      SELECT 
        o.*,
        COALESCE(o.computed_total_usd, 0) AS computed_total_usd,
        COALESCE(o.computed_total_lbp, 0) AS computed_total_lbp,
        COALESCE(o.accounting_cashed, 0) AS accounting_cashed,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name,
        dp.country as delivery_price_country,
        dp.region as delivery_price_region,
        dp.sub_region as delivery_price_sub_region,
        dp.price_lbp as delivery_price_lbp,
        dp.price_usd as delivery_price_usd
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN delivery_prices dp ON o.delivery_price_id = dp.id
      WHERE o.id = ?
    `;
    
    const orderResult = await query(orderQuery, [result.id]);

    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:created', orderResult[0]);
    } catch {}

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: orderResult[0]
    });
  } catch (error) {
    console.error('Error creating order:', error.stack || error);
    // Common DB errors
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Foreign key error: related record not found', error: error.detail || error.message });
    }
    if (/duplicate key|unique constraint/i.test(error.message || '')) {
      return res.status(409).json({ success: false, message: 'Duplicate order reference', error: error.detail || error.message });
    }
    const friendly = (/(does not exist|no such column|foreign key|constraint)/i).test(error.message || '')
      ? 'Database constraint or missing column. Check schema and payload.'
      : 'Failed to create order';
    res.status(500).json({ success: false, message: friendly, error: error.message });
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
  try {
    const { id } = req.params;
    const { status, payment_status, driver_id, fee_usd, fee_lbp, delivery_fee_usd, delivery_fee_lbp, notes } = req.body;

    // Validate input
    if (!status && !payment_status) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one field (status or payment_status) must be provided' 
      });
    }

    // Fetch current order
    const [currentOrder] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
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
    
    // Set completed_at if status becomes delivered or completed
    if (status === 'delivered' || status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Update order
    await mcp.update('orders', id, updateData);

    // If order is delivered and paid, create transactions and mark as completed
    if (status === 'delivered' && payment_status === 'paid') {
      // Update status to completed
      await mcp.update('orders', id, { status: 'completed' });
      
      // Fetch the updated order to get all details
      const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
      
      if (order) {
        // Create transaction for delivery fee
        if ((order.delivery_fee_usd || 0) > 0 || (order.delivery_fee_lbp || 0) > 0) {
          await mcp.create('transactions', {
            tx_type: 'delivery_fee',
            amount_usd: order.delivery_fee_usd || 0,
            amount_lbp: order.delivery_fee_lbp || 0,
            actor_type: 'client',
            actor_id: null,
            description: 'Order delivery fee',
            order_id: id,
            category: 'delivery',
            direction: 'credit',
            created_by: req.user.id
          });
        }

        // Create transaction for third-party payout if any
        if (order.delivery_mode === 'third_party' && ((order.third_party_fee_usd || 0) > 0 || (order.third_party_fee_lbp || 0) > 0)) {
          await mcp.create('transactions', {
            tx_type: 'third_party_payout',
            amount_usd: order.third_party_fee_usd || 0,
            amount_lbp: order.third_party_fee_lbp || 0,
            actor_type: 'third_party',
            actor_id: order.third_party_id || null,
            description: 'Third-party payout',
            order_id: id,
            category: 'payout',
            direction: 'debit',
            created_by: req.user.id
          });
        }

        // Create transaction for driver payout if any
        if ((order.driver_fee_usd || 0) > 0 || (order.driver_fee_lbp || 0) > 0) {
          await mcp.create('transactions', {
            tx_type: 'driver_payout',
            amount_usd: order.driver_fee_usd || 0,
            amount_lbp: order.driver_fee_lbp || 0,
            actor_type: 'driver',
            actor_id: order.driver_id || null,
            description: 'Driver payout',
            order_id: id,
            category: 'payout',
            direction: 'debit',
            created_by: req.user.id
          });
        }
      }
    }

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
      if (io) io.emit('order:updated', { id: Number(id), ...updateData });
    } catch {}

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: orderResult[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order status',
      error: error.message 
    });
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
  try {
    const { id } = req.params;
    const { status = 'completed', payment_status = 'paid' } = req.body;

    // Fetch order
    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Start atomic section: ensure cashbox + transactions + order update are consistent
    // Update status, payment_status, and completed_at
    await mcp.update('orders', id, {
      status: status,
      payment_status: payment_status,
      completed_at: new Date().toISOString()
    });

    // Create cashbox entry for payment if order is paid
    if (payment_status === 'paid' && ((order.total_usd || 0) > 0 || (order.total_lbp || 0) > 0)) {
      await mcp.create('cashbox_entries', {
        entry_type: 'client_payment',
        amount_usd: order.total_usd || 0,
        amount_lbp: order.total_lbp || 0,
        description: `Payment for order ${order.order_ref}`,
        actor_type: 'client',
        actor_id: null,
        created_by: req.user.id
      });

      // Update cashbox balance
      await updateCashboxBalance(order.total_usd || 0, order.total_lbp || 0);
    }

    // Ledger: credit delivery fee to company
    if ((order.delivery_fee_usd || 0) > 0 || (order.delivery_fee_lbp || 0) > 0) {
      await mcp.create('transactions', {
        tx_type: 'delivery_fee',
        amount_usd: order.delivery_fee_usd || 0,
        amount_lbp: order.delivery_fee_lbp || 0,
        actor_type: 'client',
        actor_id: null,
        description: 'Order delivery fee',
        order_id: id,
        category: 'delivery',
        direction: 'credit',
        created_by: req.user.id
      });
    }

    // Ledger: third-party payout if any for third_party mode
    if (order.delivery_mode === 'third_party' && ((order.third_party_fee_usd || 0) > 0 || (order.third_party_fee_lbp || 0) > 0)) {
      await mcp.create('transactions', {
        tx_type: 'third_party_payout',
        amount_usd: order.third_party_fee_usd || 0,
        amount_lbp: order.third_party_fee_lbp || 0,
        actor_type: 'third_party',
        actor_id: order.third_party_id || null,
        description: 'Third-party payout',
        order_id: id,
        category: 'payout',
        direction: 'debit',
        created_by: req.user.id
      });
    }

    // Optional: driver payout
    if ((order.driver_fee_usd || 0) > 0 || (order.driver_fee_lbp || 0) > 0) {
      await mcp.create('transactions', {
        tx_type: 'driver_payout',
        amount_usd: order.driver_fee_usd || 0,
        amount_lbp: order.driver_fee_lbp || 0,
        actor_type: 'driver',
        actor_id: order.driver_id || null,
        description: 'Driver payout',
        order_id: id,
        category: 'payout',
        direction: 'debit',
        created_by: req.user.id
      });
    }

    // Append order history
    try {
      await mcp.create('order_history', {
        order_id: id,
        action: 'complete',
        actor: req.user?.id ? String(req.user.id) : 'system',
        details: { status, payment_status }
      });
    } catch {}

    // Emit update event
    try {
      const io = req.app.get('io');
      if (io) io.emit('order:updated', { id: Number(id), status, payment_status });
    } catch {}

    res.json({
      success: true,
      message: 'Order completed and ledger entries created'
    });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to complete order',
      error: error.message 
    });
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

module.exports = router;

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

    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (status) { filterConditions.push(`o.status = ?`); filterParams.push(status); }

    const keyword = q || search || brand_name;
    if (keyword) {
      filterConditions.push(`(LOWER(o.brand_name) LIKE LOWER(?) OR LOWER(o.customer_name) LIKE LOWER(?) OR LOWER(o.order_ref) LIKE LOWER(?))`);
      filterParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (type) { filterConditions.push(`o.type = ?`); filterParams.push(type); }
    if (driver_id) { filterConditions.push(`o.driver_id = ?`); filterParams.push(driver_id); }
    if (payment_status) { filterConditions.push(`o.payment_status = ?`); filterParams.push(payment_status); }

    const df = from_date || date_from;
    const dt = to_date || date_to;
    if (df) { filterConditions.push(`o.created_at >= ?`); filterParams.push(df); }
    if (dt) { filterConditions.push(`o.created_at <= ?`); filterParams.push(dt); }

    const whereClause = filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';

    const ordersQuery = `
      SELECT 
        o.id, o.order_ref, o.type, o.status, o.payment_status, o.brand_name, o.customer_name, o.customer_phone, o.customer_address,
        o.total_usd, o.total_lbp, o.delivery_fee_usd, o.delivery_fee_lbp, o.driver_fee_usd, o.driver_fee_lbp,
        o.third_party_fee_usd, o.third_party_fee_lbp, o.created_at, o.updated_at, o.completed_at,
        d.full_name as driver_name,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
    `;

    const rows = await query(ordersQuery, filterParams);

    // Build CSV
    const headers = [
      'ID','Order Ref','Type','Status','Payment Status','Brand','Customer Name','Customer Phone','Customer Address',
      'Total USD','Total LBP','Delivery Fee USD','Delivery Fee LBP','Driver Fee USD','Driver Fee LBP',
      'Third Party Fee USD','Third Party Fee LBP','Driver','Created By','Created At','Updated At','Completed At'
    ];

    const toCsvValue = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [headers.join(',')];
    for (const r of rows) {
      const line = [
        r.id, r.order_ref, r.type, r.status, r.payment_status, r.brand_name, r.customer_name, r.customer_phone, r.customer_address,
        r.total_usd, r.total_lbp, r.delivery_fee_usd, r.delivery_fee_lbp, r.driver_fee_usd, r.driver_fee_lbp,
        r.third_party_fee_usd, r.third_party_fee_lbp, r.driver_name, r.created_by_name, r.created_at, r.updated_at, r.completed_at
      ].map(toCsvValue).join(',');
      lines.push(line);
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting orders CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to export orders CSV', error: error.message });
  }
});
