const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all client accounts with balance information
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      has_balance = '',
      sortBy = 'business_name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (search) {
      filterConditions.push(`(c.business_name LIKE ? OR c.contact_person LIKE ? OR c.phone LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM client_balances cb
      JOIN clients c ON cb.client_id = c.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get client accounts with balance information
    const accountsQuery = `
      SELECT 
        cb.*,
        c.business_name,
        c.contact_person,
        c.phone,
        c.address,
        c.category,
        c.created_at as client_created_at
      FROM client_balances cb
      JOIN clients c ON cb.client_id = c.id
      ${whereClause}
      ORDER BY cb.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const accountsResult = await query(accountsQuery, filterParams);

    // Filter by balance if requested
    let filteredResults = accountsResult;
    if (has_balance === 'true') {
      filteredResults = accountsResult.filter(account => 
        account.current_balance_lbp > 0 || account.current_balance_usd > 0
      );
    } else if (has_balance === 'false') {
      filteredResults = accountsResult.filter(account => 
        account.current_balance_lbp <= 0 && account.current_balance_usd <= 0
      );
    }

    res.json({
      success: true,
      data: filteredResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching client accounts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch client accounts',
      error: error.message 
    });
  }
});

// Get single client account with detailed information
router.get('/:client_id', authenticateToken, async (req, res) => {
  try {
    const { client_id } = req.params;
    const { from_date, to_date } = req.query;

    // Get client information
    const clientQuery = 'SELECT * FROM clients WHERE id = ?';
    const [client] = await query(clientQuery, [client_id]);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    // Get client account balance
    const accountQuery = 'SELECT * FROM client_accounts WHERE client_id = ?';
    const [account] = await query(accountQuery, [client_id]);

    // Get client orders
    let ordersWhereClause = 'WHERE (o.customer_name = ? OR o.customer_name = ?)';
    let ordersParams = [client.business_name, client_id.toString()];

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
        dp.region as delivery_region,
        dp.sub_region as delivery_sub_region
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN delivery_prices dp ON o.delivery_price_id = dp.id
      ${ordersWhereClause}
      ORDER BY o.created_at DESC
    `;

    const orders = await query(ordersQuery, ordersParams);

    // Get client payments
    let paymentsWhereClause = 'WHERE p.client_id = ?';
    let paymentsParams = [client_id];

    if (from_date) {
      paymentsWhereClause += ' AND p.payment_date >= ?';
      paymentsParams.push(from_date);
    }
    if (to_date) {
      paymentsWhereClause += ' AND p.payment_date <= ?';
      paymentsParams.push(to_date);
    }

    const paymentsQuery = `
      SELECT 
        p.*,
        o.order_ref,
        u.full_name as created_by_name
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      ${paymentsWhereClause}
      ORDER BY p.payment_date DESC
    `;

    const payments = await query(paymentsQuery, paymentsParams);

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_lbp), 0) as total_orders_lbp,
        COALESCE(SUM(o.total_usd), 0) as total_orders_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_lbp ELSE 0 END), 0) as paid_orders_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_usd ELSE 0 END), 0) as paid_orders_usd,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_lbp ELSE 0 END), 0) as unpaid_orders_lbp,
        COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_usd ELSE 0 END), 0) as unpaid_orders_usd,
        COALESCE(SUM(p.amount_lbp), 0) as total_payments_lbp,
        COALESCE(SUM(p.amount_usd), 0) as total_payments_usd
      FROM orders o
      LEFT JOIN payments p ON p.client_id = ?
      WHERE (o.customer_name = ? OR o.customer_name = ?)
    `;

    const [summary] = await query(summaryQuery, [client_id, client.business_name, client_id.toString()]);

    res.json({
      success: true,
      data: {
        client,
        account: account || {
          client_id: parseInt(client_id),
          old_balance_lbp: 0,
          old_balance_usd: 0,
          current_balance_lbp: 0,
          current_balance_usd: 0
        },
        orders,
        payments,
        summary: {
          total_orders: parseInt(summary.total_orders) || 0,
          total_orders_lbp: parseInt(summary.total_orders_lbp) || 0,
          total_orders_usd: parseFloat(summary.total_orders_usd) || 0,
          paid_orders_lbp: parseInt(summary.paid_orders_lbp) || 0,
          paid_orders_usd: parseFloat(summary.paid_orders_usd) || 0,
          unpaid_orders_lbp: parseInt(summary.unpaid_orders_lbp) || 0,
          unpaid_orders_usd: parseFloat(summary.unpaid_orders_usd) || 0,
          total_payments_lbp: parseInt(summary.total_payments_lbp) || 0,
          total_payments_usd: parseFloat(summary.total_payments_usd) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client account:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch client account',
      error: error.message 
    });
  }
});

// Update client account (set old balance)
router.put('/:client_id', authenticateToken, async (req, res) => {
  try {
    const { client_id } = req.params;
    const { old_balance_lbp = 0, old_balance_usd = 0 } = req.body;

    // Check if client exists
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    // Get or create client account
    const [existingAccount] = await query('SELECT * FROM client_accounts WHERE client_id = ?', [client_id]);
    
    if (existingAccount) {
      // Update existing account
      await mcp.update('client_accounts', existingAccount.id, {
        old_balance_lbp: parseInt(old_balance_lbp) || 0,
        old_balance_usd: parseFloat(old_balance_usd) || 0,
        last_updated: new Date().toISOString()
      });
    } else {
      // Create new account
      await mcp.create('client_accounts', {
        client_id: parseInt(client_id),
        old_balance_lbp: parseInt(old_balance_lbp) || 0,
        old_balance_usd: parseFloat(old_balance_usd) || 0,
        current_balance_lbp: parseInt(old_balance_lbp) || 0,
        current_balance_usd: parseFloat(old_balance_usd) || 0,
        last_updated: new Date().toISOString()
      });
    }

    // Fetch updated account
    const accountQuery = `
      SELECT 
        ca.*,
        c.business_name,
        c.contact_person,
        c.phone
      FROM client_accounts ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.client_id = ?
    `;
    
    const [account] = await query(accountQuery, [client_id]);

    res.json({
      success: true,
      message: 'Client account updated successfully',
      data: account
    });
  } catch (error) {
    console.error('Error updating client account:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update client account',
      error: error.message 
    });
  }
});

// Recalculate client balance
router.post('/:client_id/recalculate', authenticateToken, async (req, res) => {
  try {
    const { client_id } = req.params;

    // Check if client exists
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    // Get old balance
    const [account] = await query('SELECT * FROM client_accounts WHERE client_id = ?', [client_id]);
    const oldBalanceLbp = account ? account.old_balance_lbp : 0;
    const oldBalanceUsd = account ? account.old_balance_usd : 0;

    // Calculate total orders (unpaid)
    const ordersQuery = `
      SELECT 
        COALESCE(SUM(total_lbp), 0) as total_orders_lbp,
        COALESCE(SUM(total_usd), 0) as total_orders_usd
      FROM orders 
      WHERE (customer_name = ? OR customer_name = ?) AND payment_status = 'unpaid'
    `;
    const [ordersTotal] = await query(ordersQuery, [client.business_name, client_id.toString()]);

    // Calculate total payments
    const paymentsQuery = `
      SELECT 
        COALESCE(SUM(amount_lbp), 0) as total_payments_lbp,
        COALESCE(SUM(amount_usd), 0) as total_payments_usd
      FROM payments 
      WHERE client_id = ?
    `;
    const [paymentsTotal] = await query(paymentsQuery, [client_id]);

    // Calculate new balance
    const newBalanceLbp = oldBalanceLbp + parseInt(ordersTotal.total_orders_lbp) - parseInt(paymentsTotal.total_payments_lbp);
    const newBalanceUsd = oldBalanceUsd + parseFloat(ordersTotal.total_orders_usd) - parseFloat(paymentsTotal.total_payments_usd);

    // Update or create account
    if (account) {
      await mcp.update('client_accounts', account.id, {
        current_balance_lbp: newBalanceLbp,
        current_balance_usd: newBalanceUsd,
        last_updated: new Date().toISOString()
      });
    } else {
      await mcp.create('client_accounts', {
        client_id: parseInt(client_id),
        old_balance_lbp: oldBalanceLbp,
        old_balance_usd: oldBalanceUsd,
        current_balance_lbp: newBalanceLbp,
        current_balance_usd: newBalanceUsd,
        last_updated: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Client balance recalculated successfully',
      data: {
        old_balance_lbp: oldBalanceLbp,
        old_balance_usd: oldBalanceUsd,
        total_orders_lbp: parseInt(ordersTotal.total_orders_lbp),
        total_orders_usd: parseFloat(ordersTotal.total_orders_usd),
        total_payments_lbp: parseInt(paymentsTotal.total_payments_lbp),
        total_payments_usd: parseFloat(paymentsTotal.total_payments_usd),
        new_balance_lbp: newBalanceLbp,
        new_balance_usd: newBalanceUsd
      }
    });
  } catch (error) {
    console.error('Error recalculating client balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to recalculate client balance',
      error: error.message 
    });
  }
});

// Generate client statement
router.get('/:client_id/statement', authenticateToken, async (req, res) => {
  try {
    const { client_id } = req.params;
    const { from_date, to_date, format = 'json' } = req.query;

    // Get client information
    const [client] = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    // Get account balance
    const [account] = await query('SELECT * FROM client_accounts WHERE client_id = ?', [client_id]);

    // Build date filters
    let ordersWhereClause = 'WHERE (o.customer_name = ? OR o.customer_name = ?)';
    let paymentsWhereClause = 'WHERE p.client_id = ?';
    let ordersParams = [client.business_name, client_id.toString()];
    let paymentsParams = [client_id];

    if (from_date) {
      ordersWhereClause += ' AND o.created_at >= ?';
      paymentsWhereClause += ' AND p.payment_date >= ?';
      ordersParams.push(from_date);
      paymentsParams.push(from_date);
    }

    if (to_date) {
      ordersWhereClause += ' AND o.created_at <= ?';
      paymentsWhereClause += ' AND p.payment_date <= ?';
      ordersParams.push(to_date);
      paymentsParams.push(to_date);
    }

    // Get orders
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_ref,
        o.created_at as date,
        'order' as type,
        o.total_lbp as amount_lbp,
        o.total_usd as amount_usd,
        o.payment_status,
        o.status,
        d.full_name as driver_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      ${ordersWhereClause}
      ORDER BY o.created_at ASC
    `;

    const orders = await query(ordersQuery, ordersParams);

    // Get payments
    const paymentsQuery = `
      SELECT 
        p.id,
        p.reference_number as order_ref,
        p.payment_date as date,
        'payment' as type,
        p.amount_lbp,
        p.amount_usd,
        p.payment_method as status,
        p.description,
        o.order_ref as related_order_ref
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      ${paymentsWhereClause}
      ORDER BY p.payment_date ASC
    `;

    const payments = await query(paymentsQuery, paymentsParams);

    // Combine and sort all transactions
    const allTransactions = [
      ...orders.map(order => ({
        ...order,
        type: 'order',
        description: `Order ${order.order_ref} - ${order.payment_status}`
      })),
      ...payments.map(payment => ({
        ...payment,
        type: 'payment',
        description: payment.description || `Payment ${payment.reference_number || ''}`
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalanceLbp = account ? account.old_balance_lbp : 0;
    let runningBalanceUsd = account ? account.old_balance_usd : 0;

    const statement = allTransactions.map(transaction => {
      if (transaction.type === 'order') {
        if (transaction.payment_status === 'unpaid') {
          runningBalanceLbp += transaction.amount_lbp;
          runningBalanceUsd += transaction.amount_usd;
        }
      } else if (transaction.type === 'payment') {
        runningBalanceLbp -= transaction.amount_lbp;
        runningBalanceUsd -= transaction.amount_usd;
      }

      return {
        ...transaction,
        running_balance_lbp: runningBalanceLbp,
        running_balance_usd: runningBalanceUsd
      };
    });

    const statementData = {
      client: {
        id: client.id,
        business_name: client.business_name,
        contact_person: client.contact_person,
        phone: client.phone,
        address: client.address
      },
      period: {
        from_date: from_date || 'Beginning',
        to_date: to_date || 'Present'
      },
      opening_balance: {
        lbp: account ? account.old_balance_lbp : 0,
        usd: account ? account.old_balance_usd : 0
      },
      closing_balance: {
        lbp: runningBalanceLbp,
        usd: runningBalanceUsd
      },
      transactions: statement,
      summary: {
        total_orders: orders.length,
        total_payments: payments.length,
        total_order_amount_lbp: orders.reduce((sum, o) => sum + (o.amount_lbp || 0), 0),
        total_order_amount_usd: orders.reduce((sum, o) => sum + (o.amount_usd || 0), 0),
        total_payment_amount_lbp: payments.reduce((sum, p) => sum + (p.amount_lbp || 0), 0),
        total_payment_amount_usd: payments.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
      }
    };

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date', 'Type', 'Reference', 'Description', 'Amount LBP', 'Amount USD', 
        'Running Balance LBP', 'Running Balance USD', 'Status'
      ];

      const csvRows = statement.map(tx => [
        new Date(tx.date).toISOString().split('T')[0],
        tx.type,
        tx.order_ref || '',
        tx.description || '',
        tx.amount_lbp || 0,
        tx.amount_usd || 0,
        tx.running_balance_lbp,
        tx.running_balance_usd,
        tx.status || ''
      ]);

      const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=client-${client.business_name}-statement.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: statementData
    });
  } catch (error) {
    console.error('Error generating client statement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate client statement',
      error: error.message 
    });
  }
});

// Bulk recalculate all client balances
router.post('/recalculate-all', authenticateToken, async (req, res) => {
  try {
    // Get all clients
    const clients = await query('SELECT id, business_name FROM clients');

    const results = {
      processed: 0,
      errors: []
    };

    for (const client of clients) {
      try {
        // Get old balance
        const [account] = await query('SELECT * FROM client_accounts WHERE client_id = ?', [client.id]);
        const oldBalanceLbp = account ? account.old_balance_lbp : 0;
        const oldBalanceUsd = account ? account.old_balance_usd : 0;

        // Calculate total orders (unpaid)
        const ordersQuery = `
          SELECT 
            COALESCE(SUM(total_lbp), 0) as total_orders_lbp,
            COALESCE(SUM(total_usd), 0) as total_orders_usd
          FROM orders 
          WHERE (customer_name = ? OR customer_name = ?) AND payment_status = 'unpaid'
        `;
        const [ordersTotal] = await query(ordersQuery, [client.business_name, client.id.toString()]);

        // Calculate total payments
        const paymentsQuery = `
          SELECT 
            COALESCE(SUM(amount_lbp), 0) as total_payments_lbp,
            COALESCE(SUM(amount_usd), 0) as total_payments_usd
          FROM payments 
          WHERE client_id = ?
        `;
        const [paymentsTotal] = await query(paymentsQuery, [client.id]);

        // Calculate new balance
        const newBalanceLbp = oldBalanceLbp + parseInt(ordersTotal.total_orders_lbp) - parseInt(paymentsTotal.total_payments_lbp);
        const newBalanceUsd = oldBalanceUsd + parseFloat(ordersTotal.total_orders_usd) - parseFloat(paymentsTotal.total_payments_usd);

        // Update or create account
        if (account) {
          await mcp.update('client_accounts', account.id, {
            current_balance_lbp: newBalanceLbp,
            current_balance_usd: newBalanceUsd,
            last_updated: new Date().toISOString()
          });
        } else {
          await mcp.create('client_accounts', {
            client_id: client.id,
            old_balance_lbp: oldBalanceLbp,
            old_balance_usd: oldBalanceUsd,
            current_balance_lbp: newBalanceLbp,
            current_balance_usd: newBalanceUsd,
            last_updated: new Date().toISOString()
          });
        }

        results.processed++;
      } catch (error) {
        results.errors.push({
          client_id: client.id,
          client_name: client.business_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk recalculation completed. ${results.processed} clients processed.`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk recalculation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk recalculate client balances',
      error: error.message 
    });
  }
});

module.exports = router;
