const express = require('express');
const { query, run } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');
const router = express.Router();

// Get cashbox balance (snapshot)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // First check if we have a cashbox record
    const result = await query('SELECT * FROM cashbox WHERE id = 1');
    
    if (result.length === 0) {
      // Create initial cashbox record
      await run(`
        INSERT INTO cashbox (id, type, amount_usd, amount_lbp, balance_usd, balance_lbp, initial_balance_usd, initial_balance_lbp, description, created_by) 
        VALUES (1, 'initial', 0, 0, 0, 0, 0, 0, 'Initial cashbox setup', 1)
      `);
      
      res.json({
        success: true,
        data: {
          balance_usd: 0,
          balance_lbp: 0,
          initial_balance_usd: 0,
          initial_balance_lbp: 0
        }
      });
    } else {
      const balance = result[0];
      res.json({
        success: true,
        data: {
          balance_usd: parseFloat(balance.balance_usd) || 0,
          balance_lbp: parseInt(balance.balance_lbp) || 0,
          initial_balance_usd: parseFloat(balance.initial_balance_usd) || 0,
          initial_balance_lbp: parseInt(balance.initial_balance_lbp) || 0
        }
      });
    }
  } catch (error) {
    console.error('Error fetching cashbox balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cashbox balance',
      error: error.message 
    });
  }
});

// Get cashbox history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];

    if (type) {
      whereClause = 'WHERE entry_type = ?';
      params.push(type);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM cashbox_entries ${whereClause}`;
    const countResult = await query(countQuery, params);
    const totalCount = countResult[0]?.count || 0;

    // Get cashbox entries
    const historyQuery = `
      SELECT 
        c.*,
        u.full_name as created_by_name,
        d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const historyResult = await query(historyQuery, params);

    res.json({
      success: true,
      data: historyResult || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching cashbox history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cashbox history',
      error: error.message,
      data: [] // Always return empty array on error
    });
  }
});

// Allocate cash to driver/company
router.post('/allocate', authenticateToken, async (req, res) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      description,
      actor_type = 'driver',
      actor_id
    } = req.body;

    if (!actor_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Actor ID is required' 
      });
    }

    // Check if cashbox has sufficient balance
    const currentBalance = await getCashboxBalance();
    if (currentBalance.balance_usd < amount_usd || currentBalance.balance_lbp < amount_lbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient cashbox balance for allocation' 
      });
    }

    // Create cashbox entry for allocation
    const entryData = {
      entry_type: 'driver_advance',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Cash allocation',
      actor_type: actor_type,
      actor_id: actor_id,
      created_by: req.user.id
    };

    const entryRes = await mcp.create('cashbox_entries', entryData);

    // Update cashbox balance (debit)
    const newBalanceUsd = currentBalance.balance_usd - amount_usd;
    const newBalanceLbp = currentBalance.balance_lbp - amount_lbp;
    
    await mcp.update('cashbox', 1, {
      balance_usd: newBalanceUsd,
      balance_lbp: newBalanceLbp
    });

    // Create transaction for allocation
    await mcp.create('transactions', {
      tx_type: 'cash_allocation',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      actor_type: actor_type,
      actor_id: actor_id,
      description: description || 'Cash allocation',
      category: 'cash_management',
      direction: 'debit',
      created_by: req.user.id
    });

    const entry = await query(`
      SELECT c.*, u.full_name as created_by_name, d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      WHERE c.id = ?
    `, [entryRes.id]);

    res.status(201).json({ 
      success: true, 
      message: 'Cash allocated successfully', 
      data: entry[0] 
    });
  } catch (error) {
    console.error('Error allocating cash:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to allocate cash',
      error: error.message 
    });
  }
});

// Return cash from driver/company
router.post('/return', authenticateToken, async (req, res) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      description,
      actor_type = 'driver',
      actor_id
    } = req.body;

    if (!actor_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Actor ID is required' 
      });
    }

    // Create cashbox entry for return
    const entryData = {
      entry_type: 'driver_return',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Cash return',
      actor_type: actor_type,
      actor_id: actor_id,
      created_by: req.user.id
    };

    const entryRes = await mcp.create('cashbox_entries', entryData);

    // Update cashbox balance (credit)
    const currentBalance = await getCashboxBalance();
    const newBalanceUsd = currentBalance.balance_usd + amount_usd;
    const newBalanceLbp = currentBalance.balance_lbp + amount_lbp;
    
    await mcp.update('cashbox', 1, {
      balance_usd: newBalanceUsd,
      balance_lbp: newBalanceLbp,
      initial_balance_usd: currentBalance.initial_balance_usd || 0,
      initial_balance_lbp: currentBalance.initial_balance_lbp || 0
    });

    // Create transaction for return
    await mcp.create('transactions', {
      tx_type: 'cash_return',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      actor_type: actor_type,
      actor_id: actor_id,
      description: description || 'Cash return',
      category: 'cash_management',
      direction: 'credit',
      created_by: req.user.id
    });

    const entry = await query(`
      SELECT c.*, u.full_name as created_by_name, d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      WHERE c.id = ?
    `, [entryRes.id]);

    res.status(201).json({ 
      success: true, 
      message: 'Cash returned successfully', 
      data: entry[0] 
    });
  } catch (error) {
    console.error('Error returning cash:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to return cash',
      error: error.message 
    });
  }
});

// Add income - simplified endpoint
router.post('/income', authenticateToken, async (req, res) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      description = 'Income'
    } = req.body;

    // Validate that at least one amount is provided
    if (!amount_usd && !amount_lbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one amount (USD or LBP) is required' 
      });
    }

    // Get current balance
    const currentBalance = await getCashboxBalance();
    
    // Calculate new balance
    const newBalanceUsd = currentBalance.balance_usd + (amount_usd || 0);
    const newBalanceLbp = currentBalance.balance_lbp + (amount_lbp || 0);

    // Create transaction record
    const transactionData = {
      tx_type: 'income',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description,
      category: 'income',
      direction: 'credit',
      created_by: req.user.id
    };
    
    await mcp.create('transactions', transactionData);

    // Update cashbox balance atomically
    await mcp.update('cashbox', 1, {
      balance_usd: newBalanceUsd,
      balance_lbp: newBalanceLbp
    });

    res.status(201).json({ 
      success: true, 
      message: 'Income added successfully',
      data: {
        new_balance_usd: newBalanceUsd,
        new_balance_lbp: newBalanceLbp
      }
    });
  } catch (error) {
    console.error('Error adding income:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add income',
      error: error.message 
    });
  }
});

// Add expense - simplified endpoint
router.post('/expense', authenticateToken, async (req, res) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      description = 'Expense'
    } = req.body;

    // Validate that at least one amount is provided
    if (!amount_usd && !amount_lbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one amount (USD or LBP) is required' 
      });
    }

    // Get current balance
    const currentBalance = await getCashboxBalance();
    
    // Check if there's sufficient balance
    if (currentBalance.balance_usd < (amount_usd || 0) || currentBalance.balance_lbp < (amount_lbp || 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient cashbox balance for this expense' 
      });
    }
    
    // Calculate new balance
    const newBalanceUsd = currentBalance.balance_usd - (amount_usd || 0);
    const newBalanceLbp = currentBalance.balance_lbp - (amount_lbp || 0);

    // Create transaction record
    const transactionData = {
      tx_type: 'expense',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description,
      category: 'expense',
      direction: 'debit',
      created_by: req.user.id
    };
    
    await mcp.create('transactions', transactionData);

    // Update cashbox balance atomically
    await mcp.update('cashbox', 1, {
      balance_usd: newBalanceUsd,
      balance_lbp: newBalanceLbp
    });

    res.status(201).json({ 
      success: true, 
      message: 'Expense added successfully',
      data: {
        new_balance_usd: newBalanceUsd,
        new_balance_lbp: newBalanceLbp
      }
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add expense',
      error: error.message 
    });
  }
});

// Assign cash to driver for a date (creates or updates assignment)
router.post('/assign', authenticateToken, async (req, res) => {
  try {
    const { assign_date, driver_id, assigned_usd = 0, assigned_lbp = 0, notes = '' } = req.body;

    if (!driver_id) {
      return res.status(400).json({ success: false, message: 'Driver ID is required' });
    }

    // Upsert assignment
    const upsertQuery = `
      INSERT INTO cashbox_assignments(assign_date, driver_id, assigned_usd, assigned_lbp, notes, created_by)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT (assign_date, driver_id) DO UPDATE SET
        assigned_usd = cashbox_assignments.assigned_usd + EXCLUDED.assigned_usd,
        assigned_lbp = cashbox_assignments.assigned_lbp + EXCLUDED.assigned_lbp,
        notes = EXCLUDED.notes
    `;
    const resUpsert = await run(upsertQuery, [assign_date || new Date().toISOString().slice(0,10), driver_id, assigned_usd, assigned_lbp, notes, req.user.id]);

    // Record cashbox entry and update snapshot
    const currentBalance = await getCashboxBalance();
    await mcp.create('cashbox_entries', {
      entry_type: 'driver_advance',
      amount_usd: assigned_usd,
      amount_lbp: assigned_lbp,
      actor_type: 'driver',
      actor_id: driver_id,
      description: `Assignment for ${assign_date || 'today'}`,
      created_by: req.user.id
    });
    await mcp.update('cashbox', 1, {
      balance_usd: currentBalance.balance_usd - (assigned_usd || 0),
      balance_lbp: currentBalance.balance_lbp - (assigned_lbp || 0)
    });

    res.status(201).json({ success: true, message: 'Assignment recorded' });
  } catch (error) {
    console.error('Error assigning cash:', error);
    res.status(500).json({ success: false, message: 'Failed to assign cash', error: error.message });
  }
});

// Refund endpoint adjusts initial balances
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { refund_usd = 0, refund_lbp = 0 } = req.body;

    const updateQuery = `
      UPDATE cashbox 
      SET initial_balance_usd = initial_balance_usd + ?,
          initial_balance_lbp = initial_balance_lbp + ?,
          balance_usd = balance_usd + ?,
          balance_lbp = balance_lbp + ?,
          updated_at = now()
      WHERE id = 1
    `;
    await run(updateQuery, [refund_usd, refund_lbp, refund_usd, refund_lbp]);

    // Record cash_in entry
    await mcp.create('cashbox_entries', {
      entry_type: 'cash_in',
      amount_usd: refund_usd,
      amount_lbp: refund_lbp,
      description: 'Refund adjustment',
      actor_type: 'system',
      actor_id: null,
      created_by: req.user.id
    });

    res.json({ success: true, message: 'Refund applied to cashbox balances' });
  } catch (error) {
    console.error('Error applying refund:', error);
    res.status(500).json({ success: false, message: 'Failed to apply refund', error: error.message });
  }
});

// Get cashbox entries with pagination and filtering
router.get('/entries', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'all', search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];

    if (type && type !== 'all') {
      whereConditions.push('c.entry_type = ?');
      params.push(type);
    }

    if (search) {
      whereConditions.push('(c.description LIKE ? OR d.full_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM cashbox_entries c
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const totalCount = countResult[0]?.count || 0;

    // Get entries with pagination
    const entriesQuery = `
      SELECT 
        c.*,
        u.full_name as created_by_name,
        d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const entriesResult = await query(entriesQuery, params);

    res.json({
      success: true,
      data: entriesResult || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching cashbox entries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cashbox entries',
      error: error.message,
      data: [] // Always return empty array on error
    });
  }
});

// Add driver advance
router.post('/driver-advance', authenticateToken, async (req, res) => {
  try {
    const {
      driver_id,
      amount_usd = 0,
      amount_lbp = 0,
      description
    } = req.body;

    if (!driver_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Driver ID is required' 
      });
    }

    // Use MCP layer for entry creation
    const entryData = {
      entry_type: 'driver_advance',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Driver advance',
      actor_type: 'driver',
      actor_id: driver_id,
      created_by: req.user.id
    };

    const entryRes = await mcp.create('cashbox_entries', entryData);

    // Create corresponding transaction for accounting
    const transactionData = {
      tx_type: 'driver_advance',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Driver advance',
      actor_type: 'driver',
      actor_id: driver_id,
      created_by: req.user.id
    };
    
    await mcp.create('transactions', transactionData);

    // Update snapshot (debit company)
    const currentBalance = await getCashboxBalance();
    await mcp.update('cashbox', 1, {
      balance_usd: currentBalance.balance_usd - (amount_usd || 0),
      balance_lbp: currentBalance.balance_lbp - (amount_lbp || 0)
    });

    // Fetch the created entry
    const entryQuery = `
      SELECT 
        c.*,
        u.full_name as created_by_name,
        d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      WHERE c.id = ?
    `;
    const entryResult = await query(entryQuery, [entryRes.id]);

    res.status(201).json({
      success: true,
      message: 'Driver advance created successfully',
      data: entryResult[0]
    });
  } catch (error) {
    console.error('Error creating driver advance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create driver advance',
      error: error.message 
    });
  }
});

// Add driver return
router.post('/driver-return', authenticateToken, async (req, res) => {
  try {
    const {
      driver_id,
      amount_usd = 0,
      amount_lbp = 0,
      description
    } = req.body;

    if (!driver_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Driver ID is required' 
      });
    }

    // Use MCP layer for entry creation
    const entryData = {
      entry_type: 'driver_return',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Driver return',
      actor_type: 'driver',
      actor_id: driver_id,
      created_by: req.user.id
    };

    const entryRes = await mcp.create('cashbox_entries', entryData);

    // Create corresponding transaction for accounting
    const transactionData = {
      tx_type: 'driver_return',
      amount_usd: amount_usd || 0,
      amount_lbp: amount_lbp || 0,
      description: description || 'Driver return',
      actor_type: 'driver',
      actor_id: driver_id,
      created_by: req.user.id
    };
    
    await mcp.create('transactions', transactionData);

    // Update snapshot (credit company)
    const currentBalance = await getCashboxBalance();
    await mcp.update('cashbox', 1, {
      balance_usd: currentBalance.balance_usd + (amount_usd || 0),
      balance_lbp: currentBalance.balance_lbp + (amount_lbp || 0)
    });

    // Fetch the created entry
    const entryQuery = `
      SELECT 
        c.*,
        u.full_name as created_by_name,
        d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      WHERE c.id = ?
    `;
    const entryResult = await query(entryQuery, [entryRes.id]);

    res.status(201).json({
      success: true,
      message: 'Driver return created successfully',
      data: entryResult[0]
    });
  } catch (error) {
    console.error('Error creating driver return:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create driver return',
      error: error.message 
    });
  }
});

// Delete cashbox entry
router.delete('/entry/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use MCP layer for delete
    await mcp.delete('cashbox_entries', id);

    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cashbox entry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete entry',
      error: error.message 
    });
  }
});

// Export cashbox data
router.get('/export', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { format = 'pdf', from, to } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (from) {
      whereClause += ' AND c.created_at >= ?';
      params.push(from);
    }

    if (to) {
      whereClause += ' AND c.created_at <= ?';
      params.push(to);
    }

    const exportQuery = `
      SELECT 
        c.*,
        u.full_name as created_by_name,
        d.full_name as driver_name
      FROM cashbox_entries c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN drivers d ON (c.actor_type = 'driver' AND c.actor_id = d.id)
      ${whereClause}
      ORDER BY c.created_at DESC
    `;
    
    const result = await query(exportQuery, params);

    if (format === 'csv') {
      // Generate CSV content
      const csvContent = [
        'Date,Type,Amount USD,Amount LBP,Description,Driver,Created By',
              ...result.map(row => [
        new Date(row.created_at).toLocaleDateString(),
        row.entry_type,
        row.amount_usd || 0,
        row.amount_lbp || 0,
        row.description || '',
        row.driver_name || '',
        row.created_by_name || ''
      ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cashbox-export.csv');
      res.send(csvContent);
    } else {
      // Generate PDF content (simplified)
      const pdfContent = `
        CASHBOX REPORT
        ===============
        
        Period: ${from || 'All time'} to ${to || 'Now'}
        Generated: ${new Date().toLocaleDateString()}
        
        ${result.map(row => `
        Date: ${new Date(row.created_at).toLocaleDateString()}
        Type: ${row.entry_type}
        Amount: $${row.amount_usd || 0} / ${(row.amount_lbp || 0).toLocaleString()} LBP
        Description: ${row.description || 'N/A'}
        Driver: ${row.driver_name || 'N/A'}
        Created By: ${row.created_by_name || 'System'}
        `).join('\n')}
      `;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=cashbox-export.pdf');
      res.send(Buffer.from(pdfContent, 'utf8'));
    }
  } catch (error) {
    console.error('Error exporting cashbox data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export cashbox data',
      error: error.message 
    });
  }
});

// Get cashbox balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const balanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN entry_type IN ('cash_in', 'driver_return', 'client_payment') THEN amount_usd ELSE -amount_usd END), 0) as balance_usd,
        COALESCE(SUM(CASE WHEN entry_type IN ('cash_in', 'driver_return', 'client_payment') THEN amount_lbp ELSE -amount_lbp END), 0) as balance_lbp
      FROM cashbox_entries
    `;
    
    const result = await query(balanceQuery);
    const balance = result[0] || {};

    res.json({
      success: true,
      data: {
        balance_usd: parseFloat(balance.balance_usd) || 0,
        balance_lbp: parseInt(balance.balance_lbp) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching cashbox balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cashbox balance',
      error: error.message 
    });
  }
});

// Get recent cashbox timeline
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const timelineQuery = `
      SELECT 
        t.id,
        t.tx_type,
        t.amount_usd,
        t.amount_lbp,
        t.description,
        t.category,
        t.direction,
        t.created_at,
        u.full_name as created_by_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.category IN ('income', 'expense', 'cash_management')
      ORDER BY t.created_at DESC
      LIMIT $1
    `;
    
    const timeline = await query(timelineQuery, [limit]);

    res.json({
      success: true,
      data: timeline || []
    });
  } catch (error) {
    console.error('Error fetching cashbox timeline:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cashbox timeline',
      error: error.message 
    });
  }
});

// Helper function to get cashbox balance
async function getCashboxBalance() {
  try {
    const result = await query('SELECT * FROM cashbox WHERE id = 1');
    if (result.length === 0) {
      // Create initial cashbox record if it doesn't exist
      await run(`
        INSERT INTO cashbox (id, type, amount_usd, amount_lbp, balance_usd, balance_lbp, initial_balance_usd, initial_balance_lbp, description, created_by) 
        VALUES (1, 'initial', 0, 0, 0, 0, 0, 0, 'Initial cashbox setup', 1)
      `);
      return { balance_usd: 0, balance_lbp: 0 };
    }
    return result[0] || { balance_usd: 0, balance_lbp: 0 };
  } catch (error) {
    console.error('Error getting cashbox balance:', error);
    return { balance_usd: 0, balance_lbp: 0 };
  }
}

module.exports = router;
