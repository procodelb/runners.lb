const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get comprehensive accounting data
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { view = 'overview', from_date, to_date, search = '', entity_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (from_date) {
      whereClause += ' AND t.created_at >= ?';
      params.push(from_date);
    }

    if (to_date) {
      whereClause += ' AND t.created_at <= ?';
      params.push(to_date);
    }

    if (search) {
      whereClause += ' AND (t.description LIKE ? OR t.tx_type LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    let result = {};

    if (view === 'overview') {
      // Get overview statistics
      const overviewQuery = `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) as total_income_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0) as total_expenses_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) as total_income_lbp,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0) as total_expenses_lbp
        FROM transactions t
        ${whereClause}
      `;
      
      const overviewResult = await query(overviewQuery, params);
      result.overview = overviewResult[0] || {};

      // Get recent transactions
      const recentQuery = `
        SELECT 
          t.*, t.tx_type as type,
          u.full_name as created_by_name,
          d.full_name as driver_name,
          c.business_name as client_name,
          o.order_ref as order_reference
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
        LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
        LEFT JOIN orders o ON t.order_id = o.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT 10
      `;
      
      const recentResult = await query(recentQuery, params);
      result.recent_transactions = recentResult;

    } else if (view === 'clients') {
      // Get client transactions with balance calculation
      const clientsQuery = `
        SELECT 
          c.id,
          c.business_name,
          c.contact_person,
          c.phone,
          COUNT(t.id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) as total_income_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0) as total_expenses_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) as total_income_lbp,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0) as total_expenses_lbp,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0)) as balance_usd,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0)) as balance_lbp
        FROM clients c
        LEFT JOIN transactions t ON c.id = t.actor_id AND t.actor_type = 'client'
        ${whereClause}
        GROUP BY c.id, c.business_name, c.contact_person, c.phone
        ORDER BY balance_usd DESC
      `;
      
      const clientsResult = await query(clientsQuery, params);
      result.clients = clientsResult;

    } else if (view === 'drivers') {
      // Get driver transactions with balance calculation
      const driversQuery = `
        SELECT 
          d.id,
          d.full_name,
          d.phone,
          COUNT(t.id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) as total_income_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0) as total_expenses_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) as total_income_lbp,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0) as total_expenses_lbp,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0)) as balance_usd,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0)) as balance_lbp
        FROM drivers d
        LEFT JOIN transactions t ON d.id = t.actor_id AND t.actor_type = 'driver'
        ${whereClause}
        GROUP BY d.id, d.full_name, d.phone
        ORDER BY balance_usd DESC
      `;
      
      const driversResult = await query(driversQuery, params);
      result.drivers = driversResult;

    } else if (view === 'third_parties') {
      // Get third-party transactions with balance calculation
      const thirdPartiesQuery = `
        SELECT 
          'third_party' as id,
          'Third Party Fees' as name,
          COUNT(t.id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) as total_income_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0) as total_expenses_usd,
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) as total_income_lbp,
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0) as total_expenses_lbp,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_usd ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_usd ELSE 0 END), 0)) as balance_usd,
          (COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount_lbp ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount_lbp ELSE 0 END), 0)) as balance_lbp
        FROM transactions t
        WHERE t.actor_type = 'third_party'
        ${whereClause.replace('WHERE 1=1', '')}
      `;
      
      const thirdPartiesResult = await query(thirdPartiesQuery, params);
      result.third_parties = thirdPartiesResult;

    } else if (view === 'entity_details' && entity_id) {
      // Get detailed transactions for a specific entity
      const entityDetailsQuery = `
        SELECT 
          t.*,
          u.full_name as created_by_name,
          o.order_ref as order_reference,
          o.customer_name as order_customer
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE t.actor_id = ? AND t.actor_type = ?
        ${whereClause.replace('WHERE 1=1', '')}
        ORDER BY t.created_at DESC
      `;
      
      const entityParams = [entity_id, view.slice(0, -1), ...params];
      const entityDetailsResult = await query(entityDetailsQuery, entityParams);
      result.entity_details = entityDetailsResult;
    }

    res.json({
      success: true,
      data: result || {}
    });

  } catch (error) {
    console.error('Error fetching accounting data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounting data',
      error: error.message,
      data: {} // Always return empty object on error
    });
  }
});

// Get accounting overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // Get total revenue
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(total_lbp), 0) as total_revenue_lbp
      FROM orders
    `;
    const revenueResult = await query(revenueQuery);
    const revenue = revenueResult[0] || {};

    // Get pending payments
    const pendingQuery = `
      SELECT 
        COALESCE(SUM(total_usd), 0) as pending_usd,
        COALESCE(SUM(total_lbp), 0) as pending_lbp
      FROM orders
      WHERE payment_status = 'unpaid'
    `;
    const pendingResult = await query(pendingQuery);
    const pending = pendingResult[0] || {};

    // Get transaction summary
    const transactionsQuery = `
      SELECT 
        tx_type as type,
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as total_usd,
        COALESCE(SUM(amount_lbp), 0) as total_lbp
      FROM transactions
      GROUP BY tx_type
    `;
    const transactionsResult = await query(transactionsQuery);

    // Flatten structure for frontend expectations in Accounting.jsx OverviewView
    res.json({
      success: true,
      data: {
        total_usd: parseFloat(revenue.total_revenue_usd) || 0,
        total_lbp: parseInt(revenue.total_revenue_lbp) || 0,
        pending_usd: parseFloat(pending.pending_usd) || 0,
        pending_lbp: parseInt(pending.pending_lbp) || 0,
        expenses_usd: 0,
        expenses_lbp: 0,
        cashbox_usd: 0,
        cashbox_lbp: 0,
        recent_transactions: transactionsResult || [],
        top_clients: []
      }
    });
  } catch (error) {
    console.error('Error fetching accounting overview:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounting overview',
      error: error.message 
    });
  }
});

// Get financial reports
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, type } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (from_date) {
      whereClause += ' AND created_at >= ?';
      params.push(from_date);
    }

    if (to_date) {
      whereClause += ' AND created_at <= ?';
      params.push(to_date);
    }

    if (type) {
      whereClause += ' AND tx_type = ?';
      params.push(type);
    }

    const reportsQuery = `
      SELECT 
        DATE(created_at) as date,
        tx_type as type,
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as total_usd,
        COALESCE(SUM(amount_lbp), 0) as total_lbp
      FROM transactions
      ${whereClause}
      GROUP BY DATE(created_at), tx_type
      ORDER BY date DESC
    `;

    const result = await query(reportsQuery, params);

    res.json({
      success: true,
      data: result || []
    });
  } catch (error) {
    console.error('Error fetching financial reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch financial reports',
      error: error.message,
      data: [] // Always return empty array on error
    });
  }
});

// Get all clients with accounting details
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE LOWER(c.business_name) LIKE LOWER($1) OR LOWER(c.contact_person) LIKE LOWER($1)';
      params.push(`%${search}%`);
    }

    const clientsQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0) as paid_amount_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0) as paid_amount_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) as pending_amount_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) as pending_amount_lbp,
        MAX(o.created_at) as last_order_date,
        -- Calculate balances from transactions
        COALESCE(c.old_balance_usd, 0) as old_balance_usd,
        COALESCE(c.old_balance_lbp, 0) as old_balance_lbp,
        COALESCE(SUM(o.total_usd), 0) as orders_total_usd,
        COALESCE(SUM(o.total_lbp), 0) as orders_total_lbp,
        COALESCE(SUM(o.delivery_fee_usd), 0) as fees_total_usd,
        COALESCE(SUM(o.delivery_fee_lbp), 0) as fees_total_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0) as payments_total_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0) as payments_total_lbp,
        (COALESCE(c.old_balance_usd, 0) + COALESCE(SUM(o.total_usd), 0) - COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0)) as new_balance_usd,
        (COALESCE(c.old_balance_lbp, 0) + COALESCE(SUM(o.total_lbp), 0) - COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0)) as new_balance_lbp
      FROM clients c
      LEFT JOIN orders o ON c.business_name = o.customer_name OR c.id::text = o.customer_name
      ${whereClause}
      GROUP BY c.id, c.business_name, c.contact_person, c.phone, c.address, c.instagram, c.website, c.google_location, c.category, c.created_at, c.updated_at, c.old_balance_usd, c.old_balance_lbp
      ORDER BY total_revenue_usd DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const clients = await query(clientsQuery, params);

    res.json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching accounting clients:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounting clients',
      error: error.message 
    });
  }
});

// Get client details with orders and transactions
router.get('/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get client info
    const clientQuery = 'SELECT * FROM clients WHERE id = $1';
    const clientResult = await query(clientQuery, [id]);

    if (clientResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientResult[0];

    // Get client orders
    let ordersWhereClause = 'WHERE o.customer_name = $1 OR o.customer_name = $2';
    let ordersParams = [client.business_name, id.toString()];

    if (from_date) {
      ordersWhereClause += ` AND o.created_at >= $${ordersParams.length + 1}`;
      ordersParams.push(from_date);
    }
    if (to_date) {
      ordersWhereClause += ` AND o.created_at <= $${ordersParams.length + 1}`;
      ordersParams.push(to_date);
    }

    const ordersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      ${ordersWhereClause}
      ORDER BY o.created_at DESC
    `;

    const orders = await query(ordersQuery, ordersParams);

    // Get client transactions
    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.actor_type = 'client' AND t.actor_id = $1
      ORDER BY t.created_at DESC
    `;

    const transactions = await query(transactionsQuery, [id]);

    // Calculate comprehensive balance
    const balanceQuery = `
      SELECT 
        COALESCE(c.old_balance_usd, 0) as old_balance_usd,
        COALESCE(c.old_balance_lbp, 0) as old_balance_lbp,
        COALESCE(SUM(o.total_usd), 0) as orders_total_usd,
        COALESCE(SUM(o.total_lbp), 0) as orders_total_lbp,
        COALESCE(SUM(o.delivery_fee_usd), 0) as fees_total_usd,
        COALESCE(SUM(o.delivery_fee_lbp), 0) as fees_total_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0) as payments_total_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0) as payments_total_lbp,
        (COALESCE(c.old_balance_usd, 0) + COALESCE(SUM(o.total_usd), 0) - COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0)) as new_balance_usd,
        (COALESCE(c.old_balance_lbp, 0) + COALESCE(SUM(o.total_lbp), 0) - COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0)) as new_balance_lbp
      FROM clients c
      LEFT JOIN orders o ON c.business_name = o.customer_name OR c.id::text = o.customer_name
      WHERE c.id = $1
      GROUP BY c.id, c.old_balance_usd, c.old_balance_lbp
    `;
    
    const balanceResult = await query(balanceQuery, [id]);
    const balance = balanceResult[0] || {};

    res.json({
      success: true,
      data: {
        client,
        orders,
        transactions,
        balance: {
          old_balance_usd: parseFloat(balance.old_balance_usd) || 0,
          old_balance_lbp: parseInt(balance.old_balance_lbp) || 0,
          orders_total_usd: parseFloat(balance.orders_total_usd) || 0,
          orders_total_lbp: parseInt(balance.orders_total_lbp) || 0,
          fees_total_usd: parseFloat(balance.fees_total_usd) || 0,
          fees_total_lbp: parseInt(balance.fees_total_lbp) || 0,
          payments_total_usd: parseFloat(balance.payments_total_usd) || 0,
          payments_total_lbp: parseInt(balance.payments_total_lbp) || 0,
          new_balance_usd: parseFloat(balance.new_balance_usd) || 0,
          new_balance_lbp: parseInt(balance.new_balance_lbp) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch client details',
      error: error.message 
    });
  }
});

// Cash out client account
router.post('/clients/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Client cashout' } = req.body;

    // Get client info
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Get current balance
    const balanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_usd ELSE -amount_usd END), 0) AS balance_usd,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_lbp ELSE -amount_lbp END), 0) AS balance_lbp
      FROM transactions
      WHERE actor_type = 'client' AND actor_id = ?
    `;
    const [balance] = await query(balanceQuery, [id]);

    const currentBalanceUsd = parseFloat(balance.balance_usd) || 0;
    const currentBalanceLbp = parseInt(balance.balance_lbp) || 0;

    // Validate cashout amounts
    if (amount_usd > currentBalanceUsd || amount_lbp > currentBalanceLbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cashout amount exceeds available balance' 
      });
    }

    // Create cashout transaction
    const transactionQuery = `
      INSERT INTO transactions (
        tx_type, amount_usd, amount_lbp, actor_type, actor_id,
        description, direction, category, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const transactionParams = [
      'client_cashout',
      amount_usd,
      amount_lbp,
      'client',
      id,
      description,
      'debit',
      'cashout',
      req.user.id
    ];

    const transactionResult = await run(transactionQuery, transactionParams);

    // Create order history record
    const historyQuery = `
      INSERT INTO order_history (
        client_id, action_type, amount_usd, amount_lbp,
        description, transaction_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await run(historyQuery, [
      id,
      'cashout',
      amount_usd,
      amount_lbp,
      description,
      transactionResult.id,
      req.user.id
    ]);

    // Create accounting snapshot
    const snapshotQuery = `
      INSERT INTO accounting_snapshots (
        entity_type, entity_id, snapshot_type,
        total_amount_usd, total_amount_lbp,
        net_balance_usd, net_balance_lbp,
        snapshot_data, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const snapshotData = {
      client_name: client.business_name,
      cashout_amount_usd: amount_usd,
      cashout_amount_lbp: amount_lbp,
      previous_balance_usd: currentBalanceUsd,
      previous_balance_lbp: currentBalanceLbp,
      new_balance_usd: currentBalanceUsd - amount_usd,
      new_balance_lbp: currentBalanceLbp - amount_lbp
    };

    await run(snapshotQuery, [
      'client',
      id,
      'cashout',
      amount_usd,
      amount_lbp,
      currentBalanceUsd - amount_usd,
      currentBalanceLbp - amount_lbp,
      JSON.stringify(snapshotData),
      req.user.id
    ]);

    res.json({
      success: true,
      message: 'Client cashout completed successfully',
      data: {
        transaction_id: transactionResult.id,
        amount_usd,
        amount_lbp,
        new_balance_usd: currentBalanceUsd - amount_usd,
        new_balance_lbp: currentBalanceLbp - amount_lbp
      }
    });
  } catch (error) {
    console.error('Error processing client cashout:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process client cashout',
      error: error.message 
    });
  }
});

// Export client account as CSV
router.get('/clients/:id/export/csv', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get client info
    const clientResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientResult[0];

    // Get client transactions
    let whereClause = 'WHERE t.actor_type = \'client\' AND t.actor_id = $1';
    let params = [id];

    if (from_date) {
      whereClause += ` AND t.created_at >= $${params.length + 1}`;
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ` AND t.created_at <= $${params.length + 1}`;
      params.push(to_date);
    }

    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      ${whereClause}
      ORDER BY t.created_at ASC
    `;

    const transactions = await query(transactionsQuery, params);

    // Build CSV
    const headers = [
      'Date', 'Type', 'Amount USD', 'Amount LBP', 'Direction', 'Description', 
      'Order Reference', 'Created By', 'Transaction ID'
    ];

    const csvRows = transactions.map(tx => [
      new Date(tx.created_at).toISOString().split('T')[0],
      tx.tx_type || '',
      tx.amount_usd || 0,
      tx.amount_lbp || 0,
      tx.direction || '',
      (tx.description || '').replace(/\n|\r/g, ' '),
      tx.order_reference || '',
      tx.created_by_name || '',
      tx.id
    ]);

    const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=client-${client.business_name}-account.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting client CSV:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export client CSV',
      error: error.message 
    });
  }
});

// Export client account as PDF
router.get('/clients/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get client info and statement data
    const clientResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientResult[0];

    // Get comprehensive statement data
    const statementQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        t.*,
        u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN transactions t ON t.order_id = o.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE o.customer_name = $1 OR o.customer_name = $2
      ${from_date ? `AND o.created_at >= $${from_date ? '3' : ''}` : ''}
      ${to_date ? `AND o.created_at <= $${to_date ? '4' : ''}` : ''}
      ORDER BY o.created_at DESC
    `;

    const params = [client.business_name, id.toString()];
    if (from_date) params.push(from_date);
    if (to_date) params.push(to_date);

    const statementData = await query(statementQuery, params);

    // For now, return a simple text-based PDF-like response
    // In production, you would use a proper PDF library like puppeteer or pdfkit
    const pdfContent = `
CLIENT STATEMENT
================

Client: ${client.business_name}
Contact: ${client.contact_person}
Phone: ${client.phone}
Address: ${client.address}

Statement Period: ${from_date || 'All time'} to ${to_date || 'Present'}

ORDERS:
${statementData.map(order => `
Order #${order.order_ref}
Date: ${new Date(order.created_at).toLocaleDateString()}
Amount: $${order.total_usd} / ${order.total_lbp} LBP
Status: ${order.status}
Payment: ${order.payment_status}
`).join('\n')}

Generated on: ${new Date().toLocaleString()}
    `;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=client-${client.business_name}-statement.pdf`);
    res.send(Buffer.from(pdfContent, 'utf8'));

  } catch (error) {
    console.error('Error exporting client PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export client PDF',
      error: error.message 
    });
  }
});

// Export client account as image
router.get('/clients/:id/export/image', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client info
    const clientResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientResult[0];

    // For now, return a simple text response
    // In production, you would generate an actual image using canvas or similar
    const imageContent = `Client Statement for ${client.business_name}\nGenerated on ${new Date().toLocaleString()}`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename=client-${client.business_name}-statement.png`);
    res.send(Buffer.from(imageContent, 'utf8'));

  } catch (error) {
    console.error('Error exporting client image:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export client image',
      error: error.message 
    });
  }
});

// Get all drivers with accounting details
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE LOWER(d.full_name) LIKE LOWER($1) OR LOWER(d.phone) LIKE LOWER($1)';
      params.push(`%${search}%`);
    }

    const driversQuery = `
      SELECT 
        d.*,
        COUNT(DISTINCT o.id) as total_deliveries,
        COUNT(DISTINCT driver_ops.id) as total_operations,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_delivery_fees_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_delivery_fees_lbp,
        COALESCE(SUM(driver_ops.amount_usd), 0) as total_operation_amount_usd,
        COALESCE(SUM(driver_ops.amount_lbp), 0) as total_operation_amount_lbp,
        COALESCE(SUM(CASE WHEN driver_ops.operation_type = 'fuel_expense' THEN driver_ops.amount_lbp ELSE 0 END), 0) as total_fuel_expenses_lbp,
        MAX(o.created_at) as last_delivery_date,
        -- Calculate comprehensive balances
        COALESCE(SUM(o.driver_fee_usd), 0) as earnings_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as earnings_lbp,
        COALESCE(SUM(driver_ops.amount_usd), 0) as expenses_usd,
        COALESCE(SUM(driver_ops.amount_lbp), 0) as expenses_lbp,
        (COALESCE(SUM(o.driver_fee_usd), 0) - COALESCE(SUM(driver_ops.amount_usd), 0)) as net_due_usd,
        (COALESCE(SUM(o.driver_fee_lbp), 0) - COALESCE(SUM(driver_ops.amount_lbp), 0)) as net_due_lbp
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id
      LEFT JOIN driver_operations driver_ops ON d.id = driver_ops.driver_id
      ${whereClause}
      GROUP BY d.id, d.full_name, d.phone, d.address, d.notes, d.active, d.default_fee_lbp, d.default_fee_usd, d.created_at, d.updated_at
      ORDER BY total_delivery_fees_usd DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const drivers = await query(driversQuery, params);

    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching accounting drivers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounting drivers',
      error: error.message 
    });
  }
});

// Get driver details with operations and transactions
router.get('/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get driver info
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const [driver] = await query(driverQuery, [id]);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Get driver orders
    let ordersWhereClause = 'WHERE o.driver_id = ?';
    let ordersParams = [id];

    if (from_date) {
      ordersWhereClause += ' AND o.created_at >= ?';
      ordersParams.push(from_date);
    }
    if (to_date) {
      ordersWhereClause += ' AND o.created_at <= ?';
      ordersParams.push(to_date);
    }

    const ordersQuery = `
      SELECT 
        o.*,
        c.business_name as client_name,
        c.phone as client_phone
      FROM orders o
      LEFT JOIN clients c ON o.customer_name = c.business_name OR o.customer_name = c.id::text
      ${ordersWhereClause}
      ORDER BY o.created_at DESC
    `;

    const orders = await query(ordersQuery, ordersParams);

    // Get driver operations
    let operationsWhereClause = 'WHERE driver_ops.driver_id = ?';
    let operationsParams = [id];

    if (from_date) {
      operationsWhereClause += ' AND driver_ops.created_at >= ?';
      operationsParams.push(from_date);
    }
    if (to_date) {
      operationsWhereClause += ' AND driver_ops.created_at <= ?';
      operationsParams.push(to_date);
    }

    const operationsQuery = `
      SELECT 
        driver_ops.*,
        u.full_name as created_by_name,
        o.order_ref as order_reference
      FROM driver_operations driver_ops
      LEFT JOIN users u ON driver_ops.created_by = u.id
      LEFT JOIN orders o ON driver_ops.order_id = o.id
      ${operationsWhereClause}
      ORDER BY driver_ops.created_at DESC
    `;

    const operations = await query(operationsQuery, operationsParams);

    // Get driver transactions
    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.actor_type = 'driver' AND t.actor_id = ?
      ORDER BY t.created_at DESC
    `;

    const transactions = await query(transactionsQuery, [id]);

    // Calculate balances
    const balanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_usd ELSE -amount_usd END), 0) AS balance_usd,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_lbp ELSE -amount_lbp END), 0) AS balance_lbp
      FROM transactions
      WHERE actor_type = 'driver' AND actor_id = ?
    `;
    const [balance] = await query(balanceQuery, [id]);

    res.json({
      success: true,
      data: {
        driver,
        orders,
        operations,
        transactions,
        balance: {
          usd: parseFloat(balance.balance_usd) || 0,
          lbp: parseInt(balance.balance_lbp) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching driver details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch driver details',
      error: error.message 
    });
  }
});

// Cash out driver account
router.post('/drivers/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Driver cashout' } = req.body;

    // Get driver info
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Get current balance
    const balanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_usd ELSE -amount_usd END), 0) AS balance_usd,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_lbp ELSE -amount_lbp END), 0) AS balance_lbp
      FROM transactions
      WHERE actor_type = 'driver' AND actor_id = ?
    `;
    const [balance] = await query(balanceQuery, [id]);

    const currentBalanceUsd = parseFloat(balance.balance_usd) || 0;
    const currentBalanceLbp = parseInt(balance.balance_lbp) || 0;

    // Validate cashout amounts
    if (amount_usd > currentBalanceUsd || amount_lbp > currentBalanceLbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cashout amount exceeds available balance' 
      });
    }

    // Create cashout transaction
    const transactionQuery = `
      INSERT INTO transactions (
        tx_type, amount_usd, amount_lbp, actor_type, actor_id,
        description, direction, category, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const transactionParams = [
      'driver_cashout',
      amount_usd,
      amount_lbp,
      'driver',
      id,
      description,
      'debit',
      'cashout',
      req.user.id
    ];

    const transactionResult = await run(transactionQuery, transactionParams);

    // Create order history record
    const historyQuery = `
      INSERT INTO order_history (
        driver_id, action_type, amount_usd, amount_lbp,
        description, transaction_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await run(historyQuery, [
      id,
      'cashout',
      amount_usd,
      amount_lbp,
      description,
      transactionResult.id,
      req.user.id
    ]);

    // Create accounting snapshot
    const snapshotQuery = `
      INSERT INTO accounting_snapshots (
        entity_type, entity_id, snapshot_type,
        total_amount_usd, total_amount_lbp,
        net_balance_usd, net_balance_lbp,
        snapshot_data, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const snapshotData = {
      driver_name: driver.full_name,
      cashout_amount_usd: amount_usd,
      cashout_amount_lbp: amount_lbp,
      previous_balance_usd: currentBalanceUsd,
      previous_balance_lbp: currentBalanceLbp,
      new_balance_usd: currentBalanceUsd - amount_usd,
      new_balance_lbp: currentBalanceLbp - amount_lbp
    };

    await run(snapshotQuery, [
      'driver',
      id,
      'cashout',
      amount_usd,
      amount_lbp,
      currentBalanceUsd - amount_usd,
      currentBalanceLbp - amount_lbp,
      JSON.stringify(snapshotData),
      req.user.id
    ]);

    res.json({
      success: true,
      message: 'Driver cashout completed successfully',
      data: {
        transaction_id: transactionResult.id,
        amount_usd,
        amount_lbp,
        new_balance_usd: currentBalanceUsd - amount_usd,
        new_balance_lbp: currentBalanceLbp - amount_lbp
      }
    });
  } catch (error) {
    console.error('Error processing driver cashout:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process driver cashout',
      error: error.message 
    });
  }
});

// Export driver account as CSV
router.get('/drivers/:id/export/csv', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get driver info
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Get driver transactions and operations
    let whereClause = 'WHERE (t.actor_type = \'driver\' AND t.actor_id = ?) OR (driver_ops.driver_id = ?)';
    let params = [id, id];

    if (from_date) {
      whereClause += ' AND (t.created_at >= ? OR driver_ops.created_at >= ?)';
      params.push(from_date, from_date);
    }
    if (to_date) {
      whereClause += ' AND (t.created_at <= ? OR driver_ops.created_at <= ?)';
      params.push(to_date, to_date);
    }

    const dataQuery = `
      SELECT 
        'transaction' as record_type,
        t.created_at,
        t.tx_type as type,
        t.amount_usd,
        t.amount_lbp,
        t.direction,
        t.description,
        o.order_ref as order_reference,
        u.full_name as created_by_name,
        t.id as record_id
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.actor_type = 'driver' AND t.actor_id = ?
      
      UNION ALL
      
      SELECT 
        'operation' as record_type,
        driver_ops.created_at,
        driver_ops.operation_type as type,
        driver_ops.amount_usd,
        driver_ops.amount_lbp,
        'debit' as direction,
        driver_ops.description,
        o.order_ref as order_reference,
        u.full_name as created_by_name,
        driver_ops.id as record_id
      FROM driver_operations driver_ops
      LEFT JOIN users u ON driver_ops.created_by = u.id
      LEFT JOIN orders o ON driver_ops.order_id = o.id
      WHERE driver_ops.driver_id = ?
      
      ORDER BY created_at ASC
    `;

    const records = await query(dataQuery, [id, id]);

    // Build CSV
    const headers = [
      'Date', 'Record Type', 'Type', 'Amount USD', 'Amount LBP', 'Direction', 'Description', 
      'Order Reference', 'Created By', 'Record ID'
    ];

    const csvRows = records.map(record => [
      new Date(record.created_at).toISOString().split('T')[0],
      record.record_type,
      record.type || '',
      record.amount_usd || 0,
      record.amount_lbp || 0,
      record.direction || '',
      (record.description || '').replace(/\n|\r/g, ' '),
      record.order_reference || '',
      record.created_by_name || '',
      record.record_id
    ]);

    const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=driver-${driver.full_name}-account.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting driver CSV:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export driver CSV',
      error: error.message 
    });
  }
});

// Get all third party orders with revenue split
router.get('/thirdparties', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE LOWER(o.third_party_name) LIKE LOWER($1) OR LOWER(o.customer_name) LIKE LOWER($1)';
      params.push(`%${search}%`);
    }

    const thirdPartyQuery = `
      SELECT 
        o.third_party_name as name,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        COALESCE(SUM(o.third_party_fee_usd), 0) as total_third_party_fees_usd,
        COALESCE(SUM(o.third_party_fee_lbp), 0) as total_third_party_fees_lbp,
        COALESCE(SUM(o.total_usd - o.third_party_fee_usd), 0) as our_net_share_usd,
        COALESCE(SUM(o.total_lbp - o.third_party_fee_lbp), 0) as our_net_share_lbp,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_driver_fees_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_driver_fees_lbp,
        MAX(o.created_at) as last_order_date
      FROM orders o
      WHERE o.third_party_name IS NOT NULL AND o.third_party_name != ''
      ${whereClause}
      GROUP BY o.third_party_name
      ORDER BY total_revenue_usd DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const thirdPartyData = await query(thirdPartyQuery, params);

    res.json({
      success: true,
      data: thirdPartyData
    });
  } catch (error) {
    console.error('Error fetching third party accounting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch third party accounting',
      error: error.message 
    });
  }
});

// Get third party details with orders and revenue split
router.get('/thirdparties/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { from_date, to_date } = req.query;

    // Get third party orders
    let ordersWhereClause = 'WHERE o.third_party_name = ?';
    let ordersParams = [name];

    if (from_date) {
      ordersWhereClause += ' AND o.created_at >= ?';
      ordersParams.push(from_date);
    }
    if (to_date) {
      ordersWhereClause += ' AND o.created_at <= ?';
      ordersParams.push(to_date);
    }

    const ordersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        c.business_name as client_name,
        c.phone as client_phone,
        (o.total_usd - o.third_party_fee_usd) as our_share_usd,
        (o.total_lbp - o.third_party_fee_lbp) as our_share_lbp
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.customer_name = c.business_name OR o.customer_name = c.id::text
      ${ordersWhereClause}
      ORDER BY o.created_at DESC
    `;

    const orders = await query(ordersQuery, ordersParams);

    // Get third party transactions
    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.actor_type = 'third_party' AND t.description ILIKE ?
      ORDER BY t.created_at DESC
    `;

    const transactions = await query(transactionsQuery, [`%${name}%`]);

    // Calculate revenue split summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        COALESCE(SUM(o.third_party_fee_usd), 0) as total_third_party_fees_usd,
        COALESCE(SUM(o.third_party_fee_lbp), 0) as total_third_party_fees_lbp,
        COALESCE(SUM(o.total_usd - o.third_party_fee_usd), 0) as our_net_share_usd,
        COALESCE(SUM(o.total_lbp - o.third_party_fee_lbp), 0) as our_net_share_lbp,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_driver_fees_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_driver_fees_lbp
      FROM orders o
      WHERE o.third_party_name = ?
    `;

    const [summary] = await query(summaryQuery, [name]);

    res.json({
      success: true,
      data: {
        third_party_name: name,
        orders,
        transactions,
        summary: {
          total_orders: summary.total_orders || 0,
          total_revenue_usd: parseFloat(summary.total_revenue_usd) || 0,
          total_revenue_lbp: parseInt(summary.total_revenue_lbp) || 0,
          total_third_party_fees_usd: parseFloat(summary.total_third_party_fees_usd) || 0,
          total_third_party_fees_lbp: parseInt(summary.total_third_party_fees_lbp) || 0,
          our_net_share_usd: parseFloat(summary.our_net_share_usd) || 0,
          our_net_share_lbp: parseInt(summary.our_net_share_lbp) || 0,
          total_driver_fees_usd: parseFloat(summary.total_driver_fees_usd) || 0,
          total_driver_fees_lbp: parseInt(summary.total_driver_fees_lbp) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching third party details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch third party details',
      error: error.message 
    });
  }
});

// Cash out third party account
router.post('/thirdparty/:name/cashout', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Third party cashout' } = req.body;

    // Get third party summary
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(o.third_party_fee_usd), 0) as total_third_party_fees_usd,
        COALESCE(SUM(o.third_party_fee_lbp), 0) as total_third_party_fees_lbp,
        COALESCE(SUM(o.total_usd - o.third_party_fee_usd), 0) as our_net_share_usd,
        COALESCE(SUM(o.total_lbp - o.third_party_fee_lbp), 0) as our_net_share_lbp
      FROM orders o
      WHERE o.third_party_name = ?
    `;

    const [summary] = await query(summaryQuery, [name]);

    const totalThirdPartyFeesUsd = parseFloat(summary.total_third_party_fees_usd) || 0;
    const totalThirdPartyFeesLbp = parseInt(summary.total_third_party_fees_lbp) || 0;

    // Validate cashout amounts
    if (amount_usd > totalThirdPartyFeesUsd || amount_lbp > totalThirdPartyFeesLbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cashout amount exceeds available third party fees' 
      });
    }

    // Create cashout transaction
    const transactionQuery = `
      INSERT INTO transactions (
        tx_type, amount_usd, amount_lbp, actor_type, actor_id,
        description, direction, category, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const transactionParams = [
      'third_party_cashout',
      amount_usd,
      amount_lbp,
      'third_party',
      null,
      `${description} - ${name}`,
      'debit',
      'cashout',
      req.user.id
    ];

    const transactionResult = await run(transactionQuery, transactionParams);

    // Create accounting snapshot
    const snapshotQuery = `
      INSERT INTO accounting_snapshots (
        entity_type, entity_id, snapshot_type,
        total_amount_usd, total_amount_lbp,
        net_balance_usd, net_balance_lbp,
        snapshot_data, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const snapshotData = {
      third_party_name: name,
      cashout_amount_usd: amount_usd,
      cashout_amount_lbp: amount_lbp,
      previous_third_party_fees_usd: totalThirdPartyFeesUsd,
      previous_third_party_fees_lbp: totalThirdPartyFeesLbp,
      remaining_third_party_fees_usd: totalThirdPartyFeesUsd - amount_usd,
      remaining_third_party_fees_lbp: totalThirdPartyFeesLbp - amount_lbp
    };

    await run(snapshotQuery, [
      'third_party',
      null,
      'cashout',
      amount_usd,
      amount_lbp,
      totalThirdPartyFeesUsd - amount_usd,
      totalThirdPartyFeesLbp - amount_lbp,
      JSON.stringify(snapshotData),
      req.user.id
    ]);

    res.json({
      success: true,
      message: 'Third party cashout completed successfully',
      data: {
        transaction_id: transactionResult.id,
        amount_usd,
        amount_lbp,
        remaining_third_party_fees_usd: totalThirdPartyFeesUsd - amount_usd,
        remaining_third_party_fees_lbp: totalThirdPartyFeesLbp - amount_lbp
      }
    });
  } catch (error) {
    console.error('Error processing third party cashout:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process third party cashout',
      error: error.message 
    });
  }
});

// Export third party account as CSV
router.get('/thirdparty/:name/export/csv', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { from_date, to_date } = req.query;

    // Get third party orders
    let whereClause = 'WHERE o.third_party_name = ?';
    let params = [name];

    if (from_date) {
      whereClause += ' AND o.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ' AND o.created_at <= ?';
      params.push(to_date);
    }

    const ordersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        c.business_name as client_name,
        (o.total_usd - o.third_party_fee_usd) as our_share_usd,
        (o.total_lbp - o.third_party_fee_lbp) as our_share_lbp
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.customer_name = c.business_name OR o.customer_name = c.id::text
      ${whereClause}
      ORDER BY o.created_at ASC
    `;

    const orders = await query(ordersQuery, params);

    // Build CSV
    const headers = [
      'Date', 'Order Ref', 'Customer', 'Driver', 'Total USD', 'Total LBP',
      'Third Party Fee USD', 'Third Party Fee LBP', 'Our Share USD', 'Our Share LBP',
      'Driver Fee USD', 'Driver Fee LBP', 'Status', 'Payment Status'
    ];

    const csvRows = orders.map(order => [
      new Date(order.created_at).toISOString().split('T')[0],
      order.order_ref || '',
      order.client_name || order.customer_name || '',
      order.driver_name || '',
      order.total_usd || 0,
      order.total_lbp || 0,
      order.third_party_fee_usd || 0,
      order.third_party_fee_lbp || 0,
      order.our_share_usd || 0,
      order.our_share_lbp || 0,
      order.driver_fee_usd || 0,
      order.driver_fee_lbp || 0,
      order.status || '',
      order.payment_status || ''
    ]);

    const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=third-party-${name}-orders.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting third party CSV:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export third party CSV',
      error: error.message 
    });
  }
});

// Cash Out endpoints
router.post('/clients/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Client cashout' } = req.body;

    // Create cashout transaction
    const transactionData = {
      tx_type: 'cash_out',
      amount_usd: parseFloat(amount_usd),
      amount_lbp: parseInt(amount_lbp),
      debit_account: 'cashbox',
      credit_account: 'accounts_receivable',
      actor_type: 'client',
      actor_id: parseInt(id),
      details: {
        description,
        reference: `CASHOUT-CLIENT-${id}`,
        notes: `Cashout for client ID: ${id}`
      }
    };

    // Insert transaction
    const insertResult = await run(`
      INSERT INTO transactions (tx_type, amount_usd, amount_lbp, debit_account, credit_account, actor_type, actor_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transactionData.tx_type,
      transactionData.amount_usd,
      transactionData.amount_lbp,
      transactionData.debit_account,
      transactionData.credit_account,
      transactionData.actor_type,
      transactionData.actor_id,
      JSON.stringify(transactionData.details),
      new Date().toISOString()
    ]);

    // Update client balance (reduce accounts receivable)
    await run(`
      UPDATE clients 
      SET balance_usd = COALESCE(balance_usd, 0) - ?, 
          balance_lbp = COALESCE(balance_lbp, 0) - ?,
          updated_at = ?
      WHERE id = ?
    `, [amount_usd, amount_lbp, new Date().toISOString(), id]);

    // Update cashbox balance
    await run(`
      UPDATE cashbox 
      SET balance_usd = COALESCE(balance_usd, 0) - ?, 
          balance_lbp = COALESCE(balance_lbp, 0) - ?,
          updated_at = ?
    `, [amount_usd, amount_lbp, new Date().toISOString()]);

    res.json({
      success: true,
      message: 'Client cashout completed successfully',
      data: {
        transaction_id: insertResult.lastID,
        amount_usd,
        amount_lbp,
        description
      }
    });

  } catch (error) {
    console.error('Client cashout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process client cashout',
      error: error.message
    });
  }
});

router.post('/drivers/:id/cashout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Driver cashout' } = req.body;

    // Create cashout transaction
    const transactionData = {
      tx_type: 'driver_payment',
      amount_usd: parseFloat(amount_usd),
      amount_lbp: parseInt(amount_lbp),
      debit_account: 'driver_payable',
      credit_account: 'cashbox',
      actor_type: 'driver',
      actor_id: parseInt(id),
      details: {
        description,
        reference: `CASHOUT-DRIVER-${id}`,
        notes: `Cashout for driver ID: ${id}`
      }
    };

    // Insert transaction
    const insertResult = await run(`
      INSERT INTO transactions (tx_type, amount_usd, amount_lbp, debit_account, credit_account, actor_type, actor_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transactionData.tx_type,
      transactionData.amount_usd,
      transactionData.amount_lbp,
      transactionData.debit_account,
      transactionData.credit_account,
      transactionData.actor_type,
      transactionData.actor_id,
      JSON.stringify(transactionData.details),
      new Date().toISOString()
    ]);

    // Update driver balance (reduce driver payable)
    await run(`
      UPDATE drivers 
      SET balance_usd = COALESCE(balance_usd, 0) - ?, 
          balance_lbp = COALESCE(balance_lbp, 0) - ?,
          updated_at = ?
      WHERE id = ?
    `, [amount_usd, amount_lbp, new Date().toISOString(), id]);

    // Update cashbox balance
    await run(`
      UPDATE cashbox 
      SET balance_usd = COALESCE(balance_usd, 0) - ?, 
          balance_lbp = COALESCE(balance_lbp, 0) - ?,
          updated_at = ?
    `, [amount_usd, amount_lbp, new Date().toISOString()]);

    res.json({
      success: true,
      message: 'Driver cashout completed successfully',
      data: {
        transaction_id: insertResult.lastID,
        amount_usd,
        amount_lbp,
        description
      }
    });

  } catch (error) {
    console.error('Driver cashout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process driver cashout',
      error: error.message
    });
  }
});

router.post('/thirdparty/:name/cashout', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { amount_usd = 0, amount_lbp = 0, description = 'Third party cashout' } = req.body;

    // Create cashout transaction
    const transactionData = {
      tx_type: 'third_party_fee',
      amount_usd: parseFloat(amount_usd),
      amount_lbp: parseInt(amount_lbp),
      debit_account: 'third_party_payable',
      credit_account: 'cashbox',
      actor_type: 'third_party',
      actor_id: null,
      details: {
        description,
        reference: `CASHOUT-TP-${name}`,
        notes: `Cashout for third party: ${name}`
      }
    };

    // Insert transaction
    const insertResult = await run(`
      INSERT INTO transactions (tx_type, amount_usd, amount_lbp, debit_account, credit_account, actor_type, actor_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transactionData.tx_type,
      transactionData.amount_usd,
      transactionData.amount_lbp,
      transactionData.debit_account,
      transactionData.credit_account,
      transactionData.actor_type,
      transactionData.actor_id,
      JSON.stringify(transactionData.details),
      new Date().toISOString()
    ]);

    // Update cashbox balance
    await run(`
      UPDATE cashbox 
      SET balance_usd = COALESCE(balance_usd, 0) - ?, 
          balance_lbp = COALESCE(balance_lbp, 0) - ?,
          updated_at = ?
    `, [amount_usd, amount_lbp, new Date().toISOString()]);

    res.json({
      success: true,
      message: 'Third party cashout completed successfully',
      data: {
        transaction_id: insertResult.lastID,
        amount_usd,
        amount_lbp,
        description
      }
    });

  } catch (error) {
    console.error('Third party cashout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process third party cashout',
      error: error.message
    });
  }
});

// Get balance for an entity (client, driver, third_party)
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const { actorType, actorId } = req.query;
    if (!actorType || !actorId) {
      return res.status(400).json({ success: false, message: 'actorType and actorId are required' });
    }

    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_usd ELSE -amount_usd END), 0) AS balance_usd,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_lbp ELSE -amount_lbp END), 0) AS balance_lbp
      FROM transactions
      WHERE actor_type = ? AND actor_id = ?
    `;
    const rows = await query(sql, [actorType, actorId]);
    const row = rows[0] || { balance_usd: 0, balance_lbp: 0 };
    res.json({ success: true, data: { 
      balance_usd: parseFloat(row.balance_usd) || 0, 
      balance_lbp: parseInt(row.balance_lbp) || 0 
    }});
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to compute balance', error: e.message });
  }
});

// Export statement for an entity
router.get('/statement', authenticateToken, async (req, res) => {
  try {
    const { actorType, actorId, from_date, to_date, format = 'csv' } = req.query;
    if (!actorType || !actorId) {
      return res.status(400).json({ success: false, message: 'actorType and actorId are required' });
    }

    let where = 'WHERE t.actor_type = ? AND t.actor_id = ?';
    const params = [actorType, actorId];
    if (from_date) { where += ' AND t.created_at >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND t.created_at <= ?'; params.push(to_date); }

    const sql = `
      SELECT 
        t.*, u.full_name as created_by_name, o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      ${where}
      ORDER BY t.created_at ASC
    `;
    const rows = await query(sql, params);

    if (format === 'csv') {
      const header = ['Date','Type','Amount USD','Amount LBP','Direction','Order Ref','Description','Created By'];
      const lines = rows.map(r => [
        new Date(r.created_at).toISOString(),
        r.tx_type || r.type || '',
        r.amount_usd || 0,
        r.amount_lbp || 0,
        r.direction || '',
        r.order_reference || '',
        (r.description || '').replace(/\n|\r/g,' '),
        r.created_by_name || ''
      ].join(','));
      const csv = [header.join(','), ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${actorType}-${actorId}.csv`);
      return res.send(csv);
    }

    // Simple PDF-like text buffer (replace with real PDF in production)
    const content = `STATEMENT\nActor: ${actorType}#${actorId}\nFrom: ${from_date || 'N/A'} To: ${to_date || 'N/A'}\n\n` +
      rows.map(r => `${new Date(r.created_at).toLocaleString()} | ${(r.tx_type || r.type)} | $${r.amount_usd || 0} / ${(r.amount_lbp || 0).toLocaleString()} LBP | ${r.direction || ''} | ${r.order_reference || ''} | ${r.description || ''}`).join('\n');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=statement-${actorType}-${actorId}.pdf`);
    return res.send(Buffer.from(content, 'utf8'));
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to generate statement', error: e.message });
  }
});

module.exports = router;
