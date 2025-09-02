const express = require('express');
const { query, run, usdToLbp, lbpToUsd, getExchangeRate } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all transactions with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      tx_type = '', 
      actor_type = '',
      actor_id = '',
      from_date = '',
      to_date = '',
      group_by = 'date',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (tx_type) {
      filterConditions.push(`t.tx_type = ?`);
      filterParams.push(tx_type);
    }

    if (actor_type) {
      filterConditions.push(`t.actor_type = ?`);
      filterParams.push(actor_type);
    }

    if (actor_id) {
      filterConditions.push(`t.actor_id = ?`);
      filterParams.push(actor_id);
    }

    if (from_date) {
      filterConditions.push(`t.created_at >= ?`);
      filterParams.push(from_date);
    }

    if (to_date) {
      filterConditions.push(`t.created_at <= ?`);
      filterParams.push(to_date);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM transactions t ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get transactions with pagination and proper joins
    const transactionsQuery = `
      SELECT 
        t.*,
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
      ORDER BY t.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const transactionsResult = await query(transactionsQuery, filterParams);

    // Group transactions if requested
    let groupedData = transactionsResult;
    if (group_by === 'person') {
      groupedData = groupTransactionsByPerson(transactionsResult);
    } else if (group_by === 'type') {
      groupedData = groupTransactionsByType(transactionsResult);
    }

    res.json({
      success: true,
      data: groupedData || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transactions',
      error: error.message,
      data: [] // Always return empty array on error
    });
  }
});

// Helper function to group transactions by person
function groupTransactionsByPerson(transactions) {
  const groups = {};
  
  transactions.forEach(tx => {
    const key = tx.actor_type === 'driver' ? tx.driver_name : 
                tx.actor_type === 'client' ? tx.client_name : 
                tx.actor_type || 'other';
    
    if (!groups[key]) {
      groups[key] = {
        name: key,
        type: tx.actor_type,
        transactions: [],
        total_usd: 0,
        total_lbp: 0
      };
    }
    
    groups[key].transactions.push(tx);
    groups[key].total_usd += parseFloat(tx.amount_usd || 0);
    groups[key].total_lbp += parseFloat(tx.amount_lbp || 0);
  });
  
  return Object.values(groups);
}

// Helper function to group transactions by type
function groupTransactionsByType(transactions) {
  const groups = {};
  
  transactions.forEach(tx => {
    const key = tx.tx_type || 'other';
    
    if (!groups[key]) {
      groups[key] = {
        type: key,
        transactions: [],
        total_usd: 0,
        total_lbp: 0
      };
    }
    
    groups[key].transactions.push(tx);
    groups[key].total_usd += parseFloat(tx.amount_usd || 0);
    groups[key].total_lbp += parseFloat(tx.amount_lbp || 0);
  });
  
  return Object.values(groups);
}

// Get single transaction
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transactionQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      WHERE t.id = ?
    `;
    const result = await query(transactionQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    res.json({
      success: true,
      data: result[0] || {}
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
      order_id,
      category,
      direction
    } = req.body;

    if (!tx_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction type is required' 
      });
    }

    // Compute missing currency
    let amtUsd = Number(amount_usd || 0);
    let amtLbp = Number(amount_lbp || 0);
    if (amtUsd > 0 && (!amtLbp || amtLbp === 0)) {
      amtLbp = await usdToLbp(amtUsd);
    } else if (amtLbp > 0 && (!amtUsd || amtUsd === 0)) {
      amtUsd = await lbpToUsd(amtLbp);
    }
    if (amtUsd < 0 || amtLbp < 0) {
      return res.status(400).json({ success: false, message: 'Amounts must be non-negative' });
    }

    const insertQuery = `
      INSERT INTO transactions (
        tx_type, amount_usd, amount_lbp, actor_type, actor_id,
        debit_account, credit_account, description, order_id, category, direction, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      tx_type, amtUsd, amtLbp, actor_type, actor_id,
      debit_account, credit_account, description, order_id || null, category || null, direction || null, req.user.id
    ];

    const result = await run(insertQuery, params);

    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) io.emit('transaction:created', { id: result.id, tx_type, amount_usd: amtUsd, amount_lbp: amtLbp });
    } catch {}

    // Fetch the created transaction
    const transactionQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      WHERE t.id = ?
    `;
    const transactionResult = await query(transactionQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transactionResult[0] || {}
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
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateQuery = `UPDATE transactions SET ${setClause} WHERE id = ?`;
    
    values.push(id);
    await run(updateQuery, values);

    // Fetch the updated transaction
    const transactionQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      WHERE t.id = ?
    `;
    const transactionResult = await query(transactionQuery, [id]);

    if (transactionResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transactionResult[0] || {}
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
    
    const deleteQuery = 'DELETE FROM transactions WHERE id = ?';
    const result = await run(deleteQuery, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

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

// Print transaction receipt
router.get('/:id/print', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transactionQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      WHERE t.id = ?
    `;
    const result = await query(transactionQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    const transaction = result[0];
    
    // Generate PDF receipt (simplified version - in production you'd use a proper PDF library)
    const receiptContent = `
      TRANSACTION RECEIPT
      ===================
      
      Receipt ID: ${transaction.id}
      Date: ${new Date(transaction.created_at).toLocaleDateString()}
      Time: ${new Date(transaction.created_at).toLocaleTimeString()}
      
              Transaction Type: ${transaction.type}
      Amount USD: $${transaction.amount_usd || 0}
      Amount LBP: ${(transaction.amount_lbp || 0).toLocaleString()} LBP
      
      Actor: ${transaction.actor_type} - ${transaction.driver_name || transaction.client_name || 'N/A'}
      Description: ${transaction.description || 'N/A'}
      
      Created By: ${transaction.created_by_name || 'System'}
      
      ===================
      Thank you for your business!
    `;

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${transaction.id}.pdf`);
    
    // For now, return text content (in production, use a PDF library like pdfkit)
    res.send(Buffer.from(receiptContent, 'utf8'));
    
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate receipt',
      error: error.message 
    });
  }
});

// Get transactions by actor type and ID
router.get('/actor/:actorType/:actorId', authenticateToken, async (req, res) => {
  try {
    const { actorType, actorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const transactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      WHERE t.actor_type = ? AND t.actor_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await query(transactionsQuery, [actorType, actorId, limit, offset]);

    res.json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.length
      }
    });
  } catch (error) {
    console.error('Error fetching actor transactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch actor transactions',
      error: error.message 
    });
  }
});

module.exports = router;

// Additional entity query alias endpoint: /transactions?driverId=123
router.get('/by-entity', authenticateToken, async (req, res) => {
  try {
    const { driverId, clientId, thirdPartyId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (driverId) { where += ' AND t.actor_type = \"driver\" AND t.actor_id = ?'; params.push(driverId); }
    if (clientId) { where += ' AND t.actor_type = \"client\" AND t.actor_id = ?'; params.push(clientId); }
    if (thirdPartyId) { where += ' AND t.actor_type = \"third_party\" AND t.actor_id = ?'; params.push(thirdPartyId); }

    const sql = `
      SELECT 
        t.*, u.full_name as created_by_name, d.full_name as driver_name, c.business_name as client_name, o.order_ref as order_reference
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN drivers d ON t.actor_type = 'driver' AND t.actor_id = d.id
      LEFT JOIN clients c ON t.actor_type = 'client' AND t.actor_id = c.id
      LEFT JOIN orders o ON t.order_id = o.id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    const rows = await query(sql, params);
    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: rows.length } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions by entity', error: e.message, data: [] });
  }
});

