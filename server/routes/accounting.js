const express = require('express');
const { query } = require('../config/database');
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
      data: result
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
        COALESCE(tx_type, type) as type,
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as total_usd,
        COALESCE(SUM(amount_lbp), 0) as total_lbp
      FROM transactions
      GROUP BY COALESCE(tx_type, type)
    `;
    const transactionsResult = await query(transactionsQuery);

    res.json({
      success: true,
      data: {
        revenue: {
          usd: parseFloat(revenue.total_revenue_usd) || 0,
          lbp: parseInt(revenue.total_revenue_lbp) || 0
        },
        pending: {
          usd: parseFloat(pending.pending_usd) || 0,
          lbp: parseInt(pending.pending_lbp) || 0
        },
        transactions: transactionsResult || []
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
      whereClause += ' AND type = ?';
      params.push(type);
    }

    const reportsQuery = `
      SELECT 
        DATE(created_at) as date,
        COALESCE(tx_type, type) as type,
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as total_usd,
        COALESCE(SUM(amount_lbp), 0) as total_lbp
      FROM transactions
      ${whereClause}
      GROUP BY DATE(created_at), COALESCE(tx_type, type)
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

module.exports = router;

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
