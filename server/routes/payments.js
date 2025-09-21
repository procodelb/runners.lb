const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all payments with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      client_id = '', 
      order_id = '',
      payment_method = '',
      from_date = '',
      to_date = '',
      search = '',
      sortBy = 'payment_date',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (client_id) {
      filterConditions.push(`p.client_id = ?`);
      filterParams.push(client_id);
    }

    if (order_id) {
      filterConditions.push(`p.order_id = ?`);
      filterParams.push(order_id);
    }

    if (payment_method) {
      filterConditions.push(`p.payment_method = ?`);
      filterParams.push(payment_method);
    }

    if (from_date) {
      filterConditions.push(`p.payment_date >= ?`);
      filterParams.push(from_date);
    }

    if (to_date) {
      filterConditions.push(`p.payment_date <= ?`);
      filterParams.push(to_date);
    }

    if (search) {
      filterConditions.push(`(c.business_name LIKE ? OR p.description LIKE ? OR p.reference_number LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get payments with pagination
    const paymentsQuery = `
      SELECT 
        p.*,
        c.business_name as client_name,
        c.contact_person as client_contact,
        c.phone as client_phone,
        o.order_ref,
        o.customer_name as order_customer,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const paymentsResult = await query(paymentsQuery, filterParams);

    res.json({
      success: true,
      data: paymentsResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payments',
      error: error.message 
    });
  }
});

// Get single payment
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const paymentQuery = `
      SELECT 
        p.*,
        c.business_name as client_name,
        c.contact_person as client_contact,
        c.phone as client_phone,
        o.order_ref,
        o.customer_name as order_customer,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `;
    
    const result = await query(paymentQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment',
      error: error.message 
    });
  }
});

// Create new payment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      client_id,
      order_id,
      amount_lbp = 0,
      amount_usd = 0,
      payment_method = 'cash',
      payment_date,
      description,
      reference_number
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client ID is required' 
      });
    }

    // Use MCP layer for creation
    const paymentData = {
      client_id: parseInt(client_id),
      order_id: order_id ? parseInt(order_id) : null,
      amount_lbp: parseInt(amount_lbp) || 0,
      amount_usd: parseFloat(amount_usd) || 0,
      payment_method,
      payment_date: payment_date || new Date().toISOString(),
      description: description || '',
      reference_number: reference_number || '',
      created_by: req.user.id
    };

    const result = await mcp.create('payments', paymentData);

    // Update client account balance
    await updateClientBalance(client_id, amount_lbp, amount_usd, 'payment');

    // If payment is for a specific order, update order payment status
    if (order_id) {
      await updateOrderPaymentStatus(order_id);
    }

    // Fetch the created payment with joins
    const paymentQuery = `
      SELECT 
        p.*,
        c.business_name as client_name,
        c.contact_person as client_contact,
        c.phone as client_phone,
        o.order_ref,
        o.customer_name as order_customer,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `;
    
    const paymentResult = await query(paymentQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: paymentResult[0]
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment',
      error: error.message 
    });
  }
});

// Update payment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Get current payment to calculate differences
    const [currentPayment] = await query('SELECT * FROM payments WHERE id = ?', [id]);
    if (!currentPayment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    // Convert numeric fields
    if (updateData.amount_lbp !== undefined) {
      updateData.amount_lbp = parseInt(updateData.amount_lbp) || 0;
    }
    if (updateData.amount_usd !== undefined) {
      updateData.amount_usd = parseFloat(updateData.amount_usd) || 0;
    }

    // Use MCP layer for update
    await mcp.update('payments', id, updateData);

    // If amounts changed, update client balance
    if (updateData.amount_lbp !== undefined || updateData.amount_usd !== undefined) {
      const lbpDiff = (updateData.amount_lbp || currentPayment.amount_lbp) - currentPayment.amount_lbp;
      const usdDiff = (updateData.amount_usd || currentPayment.amount_usd) - currentPayment.amount_usd;
      
      if (lbpDiff !== 0 || usdDiff !== 0) {
        await updateClientBalance(currentPayment.client_id, -lbpDiff, -usdDiff, 'payment_adjustment');
      }
    }

    // Fetch the updated payment
    const paymentQuery = `
      SELECT 
        p.*,
        c.business_name as client_name,
        c.contact_person as client_contact,
        c.phone as client_phone,
        o.order_ref,
        o.customer_name as order_customer,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `;
    
    const paymentResult = await query(paymentQuery, [id]);

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: paymentResult[0]
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update payment',
      error: error.message 
    });
  }
});

// Delete payment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get payment details before deletion
    const [payment] = await query('SELECT * FROM payments WHERE id = ?', [id]);
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    // Use MCP layer for delete
    await mcp.delete('payments', id);

    // Update client balance (reverse the payment)
    await updateClientBalance(payment.client_id, -payment.amount_lbp, -payment.amount_usd, 'payment_deletion');

    // If payment was for a specific order, update order payment status
    if (payment.order_id) {
      await updateOrderPaymentStatus(payment.order_id);
    }

    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete payment',
      error: error.message 
    });
  }
});

// Get client payment history
router.get('/client/:client_id', authenticateToken, async (req, res) => {
  try {
    const { client_id } = req.params;
    const { from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.client_id = ?';
    let params = [client_id];

    if (from_date) {
      whereClause += ' AND p.payment_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      whereClause += ' AND p.payment_date <= ?';
      params.push(to_date);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM payments p ${whereClause}`;
    const countResult = await query(countQuery, params);
    const totalCount = countResult[0]?.count || 0;

    // Get payments
    const paymentsQuery = `
      SELECT 
        p.*,
        o.order_ref,
        o.customer_name as order_customer,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const payments = await query(paymentsQuery, params);

    // Get client balance
    const balanceQuery = `
      SELECT 
        COALESCE(SUM(amount_lbp), 0) as total_payments_lbp,
        COALESCE(SUM(amount_usd), 0) as total_payments_usd
      FROM payments 
      WHERE client_id = ?
    `;
    const [balance] = await query(balanceQuery, [client_id]);

    res.json({
      success: true,
      data: {
        payments,
        balance: {
          total_payments_lbp: parseInt(balance.total_payments_lbp) || 0,
          total_payments_usd: parseFloat(balance.total_payments_usd) || 0
        }
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching client payments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch client payments',
      error: error.message 
    });
  }
});

// Get payment summary statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, client_id } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (from_date) {
      whereClause += ' AND payment_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      whereClause += ' AND payment_date <= ?';
      params.push(to_date);
    }

    if (client_id) {
      whereClause += ' AND client_id = ?';
      params.push(client_id);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount_lbp), 0) as total_amount_lbp,
        COALESCE(SUM(amount_usd), 0) as total_amount_usd,
        COALESCE(AVG(amount_lbp), 0) as avg_amount_lbp,
        COALESCE(AVG(amount_usd), 0) as avg_amount_usd,
        payment_method,
        COUNT(*) as method_count
      FROM payments 
      ${whereClause}
      GROUP BY payment_method
    `;

    const methodStats = await query(statsQuery, params);

    const totalStatsQuery = `
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount_lbp), 0) as total_amount_lbp,
        COALESCE(SUM(amount_usd), 0) as total_amount_usd
      FROM payments 
      ${whereClause}
    `;

    const [totalStats] = await query(totalStatsQuery, params);

    res.json({
      success: true,
      data: {
        total: {
          payments: parseInt(totalStats.total_payments) || 0,
          amount_lbp: parseInt(totalStats.total_amount_lbp) || 0,
          amount_usd: parseFloat(totalStats.total_amount_usd) || 0
        },
        by_method: methodStats
      }
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment statistics',
      error: error.message 
    });
  }
});

// Helper function to update client balance
async function updateClientBalance(clientId, lbpAmount, usdAmount, description) {
  try {
    // Get or create client account
    const [existingAccount] = await query('SELECT * FROM client_accounts WHERE client_id = ?', [clientId]);
    
    if (existingAccount) {
      // Update existing account
      await run(`
        UPDATE client_accounts 
        SET current_balance_lbp = current_balance_lbp + ?,
            current_balance_usd = current_balance_usd + ?,
            last_updated = ?,
            updated_at = ?
        WHERE client_id = ?
      `, [lbpAmount, usdAmount, new Date().toISOString(), new Date().toISOString(), clientId]);
    } else {
      // Create new account
      await run(`
        INSERT INTO client_accounts (client_id, current_balance_lbp, current_balance_usd, last_updated)
        VALUES (?, ?, ?, ?)
      `, [clientId, lbpAmount, usdAmount, new Date().toISOString()]);
    }

    // Create transaction record
    await mcp.create('transactions', {
      tx_type: 'payment',
      amount_usd: Math.abs(usdAmount),
      amount_lbp: Math.abs(lbpAmount),
      actor_type: 'client',
      actor_id: clientId,
      description: description,
      direction: lbpAmount > 0 || usdAmount > 0 ? 'credit' : 'debit',
      category: 'payment',
      created_by: 1 // System user
    });

  } catch (error) {
    console.error('Error updating client balance:', error);
    throw error;
  }
}

// Helper function to update order payment status
async function updateOrderPaymentStatus(orderId) {
  try {
    // Get total payments for this order
    const [paymentTotal] = await query(`
      SELECT 
        COALESCE(SUM(amount_lbp), 0) as total_payments_lbp,
        COALESCE(SUM(amount_usd), 0) as total_payments_usd
      FROM payments 
      WHERE order_id = ?
    `, [orderId]);

    // Get order total
    const [order] = await query('SELECT total_lbp, total_usd FROM orders WHERE id = ?', [orderId]);
    
    if (order) {
      let paymentStatus = 'unpaid';
      
      if (paymentTotal.total_payments_lbp >= order.total_lbp && paymentTotal.total_payments_usd >= order.total_usd) {
        paymentStatus = 'paid';
      } else if (paymentTotal.total_payments_lbp > 0 || paymentTotal.total_payments_usd > 0) {
        paymentStatus = 'partial';
      }

      await mcp.update('orders', orderId, { payment_status: paymentStatus });
    }
  } catch (error) {
    console.error('Error updating order payment status:', error);
    throw error;
  }
}

module.exports = router;
