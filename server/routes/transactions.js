const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const mcp = require('../mcp');

// Get transactions with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      limit = 10, 
      offset = 0, 
      type = 'all',
      from_date,
      to_date,
      actor_type 
    } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    // Check if we're using SQLite or PostgreSQL - same logic as database.js
    const isSQLite = String(process.env.USE_SQLITE || '').toLowerCase() === 'true';
    const paramPlaceholder = isSQLite ? '?' : '$';
    
    if (type !== 'all') {
      whereClause += ` AND ${isSQLite ? 'type' : 'tx_type'} = ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (from_date) {
      whereClause += ` AND created_at >= ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }
    
    if (to_date) {
      whereClause += ` AND created_at <= ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }
    
    if (actor_type) {
      whereClause += ` AND actor_type = ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(actor_type);
      paramIndex++;
    }
    
    const typeColumn = isSQLite ? 'type' : 'tx_type';
    
    // Get transactions from both transactions table and cashbox_entries
    const transactionsQuery = `
      SELECT * FROM (
        SELECT 
          t.id,
          t.${typeColumn} as type,
          t.amount_usd,
          t.amount_lbp,
          t.actor_type,
          t.actor_id,
          t.description,
          t.created_at,
          ${isSQLite ? 't.created_at' : 't.updated_at'} as updated_at,
          u.full_name as created_by_name,
          'transaction' as source
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        ${whereClause.replace('tx_type', typeColumn)}
        
        ${!isSQLite ? `
        UNION ALL
        
        SELECT 
          ce.id,
          ce.entry_type as type,
          ce.amount_usd,
          ce.amount_lbp,
          ce.actor_type,
          ce.actor_id,
          ce.description,
          ce.created_at,
          ce.created_at as updated_at,
          u.full_name as created_by_name,
          'cashbox' as source
        FROM cashbox_entries ce
        LEFT JOIN users u ON ce.created_by = u.id
        ${whereClause.replace('tx_type', 'entry_type')}
        ` : ''}
      ) combined
      ORDER BY created_at DESC
      LIMIT ${isSQLite ? '?' : '$' + paramIndex} OFFSET ${isSQLite ? '?' : '$' + (paramIndex + 1)}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const transactions = await mcp.queryWithJoins(transactionsQuery, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT id FROM transactions ${whereClause.replace('tx_type', typeColumn)}
        ${!isSQLite ? `
        UNION ALL
        SELECT id FROM cashbox_entries ${whereClause.replace('tx_type', 'entry_type')}
        ` : ''}
      ) combined
    `;
    
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await mcp.queryWithJoins(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || 0);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if we're using SQLite or PostgreSQL - same logic as database.js
    const isSQLite = String(process.env.USE_SQLITE || '').toLowerCase() === 'true';
    const paramPlaceholder = isSQLite ? '?' : '$1';
    
    // Try to find in transactions table first
    let transaction = await mcp.queryWithJoins(`
      SELECT 
        t.*,
        u.full_name as created_by_name,
        'transaction' as source
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ${paramPlaceholder}
    `, [id]);
    
    // If not found and using PostgreSQL, try cashbox_entries
    if (transaction.length === 0 && !isSQLite) {
      transaction = await mcp.queryWithJoins(`
        SELECT 
          ce.*,
          u.full_name as created_by_name,
          'cashbox' as source
        FROM cashbox_entries ce
        LEFT JOIN users u ON ce.created_by = u.id
        WHERE ce.id = ${paramPlaceholder}
      `, [id]);
    }
    
    if (transaction.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction[0]
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// Create new transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      tx_type,
      amount_usd = 0,
      amount_lbp = 0,
      actor_type,
      actor_id,
      debit_account,
      credit_account,
      description,
      category,
      direction,
      order_id
    } = req.body;
    
    const userId = req.user.id;
    
    if (!tx_type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Transaction type and description are required'
      });
    }
    
    const transaction = await mcp.create('transactions', {
      tx_type,
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      actor_type,
      actor_id,
      debit_account,
      credit_account,
      description,
      category,
      direction,
      order_id,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
});

// Update transaction
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;
    
    const updatedTransaction = await mcp.update('transactions', id, updateData);
    
    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: updatedTransaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message
    });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await mcp.delete('transactions', id);
    
    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message
    });
  }
});

// Get transaction statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    // Check if we're using SQLite or PostgreSQL - same logic as database.js
    const isSQLite = String(process.env.USE_SQLITE || '').toLowerCase() === 'true';
    
    if (from_date) {
      whereClause += ` AND created_at >= ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }
    
    if (to_date) {
      whereClause += ` AND created_at <= ${isSQLite ? '?' : '$' + paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }
    
    // Get statistics from both tables
    const statsQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN amount_usd > 0 THEN amount_usd ELSE 0 END) as total_income_usd,
        SUM(CASE WHEN amount_lbp > 0 THEN amount_lbp ELSE 0 END) as total_income_lbp,
        SUM(CASE WHEN amount_usd < 0 THEN ABS(amount_usd) ELSE 0 END) as total_expense_usd,
        SUM(CASE WHEN amount_lbp < 0 THEN ABS(amount_lbp) ELSE 0 END) as total_expense_lbp
      FROM (
        SELECT amount_usd, amount_lbp, created_at FROM transactions ${whereClause}
        ${!isSQLite ? `
        UNION ALL
        SELECT 
          CASE WHEN entry_type IN ('income', 'cash_in', 'capital_add') THEN amount_usd ELSE -amount_usd END as amount_usd,
          CASE WHEN entry_type IN ('income', 'cash_in', 'capital_add') THEN amount_lbp ELSE -amount_lbp END as amount_lbp,
          created_at 
        FROM cashbox_entries ${whereClause}
        ` : ''}
      ) combined
    `;
    
    const stats = await mcp.queryWithJoins(statsQuery, params);
    
    res.json({
      success: true,
      data: stats[0] || {
        total_transactions: 0,
        total_income_usd: 0,
        total_income_lbp: 0,
        total_expense_usd: 0,
        total_expense_lbp: 0
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics',
      error: error.message
    });
  }
});

module.exports = router;
