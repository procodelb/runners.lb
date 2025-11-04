const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const mcp = require('../mcp');

// Helper function to get cashbox data
async function getCashboxData() {
  try {
    const result = await mcp.queryWithJoins('SELECT * FROM cashbox WHERE id = 1');
    return result[0] || {
      id: 1,
      balance_usd: 0,
      balance_lbp: 0,
      initial_capital_usd: 0,
      initial_capital_lbp: 0,
      cash_balance_usd: 0,
      cash_balance_lbp: 0,
      wish_balance_usd: 0,
      wish_balance_lbp: 0
    };
  } catch (error) {
    console.error('Error getting cashbox data:', error);
    throw error;
  }
}

// Helper function to update cashbox balances
async function updateCashboxBalances(usdDelta, lbpDelta, accountType = 'cash') {
  try {
    const current = await getCashboxData();
    
    const updates = {
      updated_at: new Date().toISOString()
    };
    
    // Update specific account balance
    if (accountType === 'cash') {
      updates.cash_balance_usd = Number(current.cash_balance_usd) + Number(usdDelta);
      updates.cash_balance_lbp = Number(current.cash_balance_lbp) + Number(lbpDelta);
      updates.wish_balance_usd = Number(current.wish_balance_usd);
      updates.wish_balance_lbp = Number(current.wish_balance_lbp);
    } else if (accountType === 'wish') {
      updates.cash_balance_usd = Number(current.cash_balance_usd);
      updates.cash_balance_lbp = Number(current.cash_balance_lbp);
      updates.wish_balance_usd = Number(current.wish_balance_usd) + Number(usdDelta);
      updates.wish_balance_lbp = Number(current.wish_balance_lbp) + Number(lbpDelta);
    }
    
    // Main balance is always the sum of cash + wish
    updates.balance_usd = updates.cash_balance_usd + updates.wish_balance_usd;
    updates.balance_lbp = updates.cash_balance_lbp + updates.wish_balance_lbp;
    
    await mcp.update('cashbox', 1, updates);
    return await getCashboxData();
  } catch (error) {
    console.error('Error updating cashbox balances:', error);
    throw error;
  }
}

// Get cashbox overview
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const cashboxData = await getCashboxData();
    res.json({
      success: true,
      data: cashboxData
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

// Get cashbox timeline/history
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0, type = 'all' } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (type !== 'all') {
      whereClause = 'WHERE entry_type = $1';
      params.push(type);
    }
    
    const entries = await mcp.queryWithJoins(`
      SELECT ce.*, u.full_name as created_by_name
      FROM cashbox_entries ce
      LEFT JOIN users u ON ce.created_by = u.id
      ${whereClause}
      ORDER BY ce.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);
    
    // Transform for frontend compatibility
    const transformedEntries = entries.map(entry => ({
      ...entry,
      tx_type: entry.entry_type // Map to expected field name
    }));
    
    res.json({
      success: true,
      data: transformedEntries
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

// Set initial capital
router.post('/capital', authenticateToken, async (req, res) => {
  try {
    const { amount_usd = 0, amount_lbp = 0, account_type = 'cash', description = 'Initial capital setup' } = req.body;
    const userId = req.user.id;
    
    
    // Update cashbox with initial capital
    const updates = {
      initial_capital_usd: Number(amount_usd),
      initial_capital_lbp: Number(amount_lbp),
      capital_set_at: new Date().toISOString(),
      capital_set_by: userId,
      updated_at: new Date().toISOString()
    };
    
    // Add to the selected account
    if (account_type === 'cash') {
      updates.cash_balance_usd = Number(amount_usd);
      updates.cash_balance_lbp = Number(amount_lbp);
      updates.wish_balance_usd = 0;
      updates.wish_balance_lbp = 0;
    } else if (account_type === 'wish') {
      updates.cash_balance_usd = 0;
      updates.cash_balance_lbp = 0;
      updates.wish_balance_usd = Number(amount_usd);
      updates.wish_balance_lbp = Number(amount_lbp);
    }
    
    // Main balance is always the sum of cash + wish
    updates.balance_usd = updates.cash_balance_usd + updates.wish_balance_usd;
    updates.balance_lbp = updates.cash_balance_lbp + updates.wish_balance_lbp;
    
    await mcp.update('cashbox', 1, updates);
    
    // Create cashbox entry for capital
    await mcp.create('cashbox_entries', {
      entry_type: 'capital_add',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type,
      description,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Capital set successfully',
      data: updatedCashbox
    });
  } catch (error) {
    console.error('Error setting capital:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set capital',
      error: error.message
    });
  }
});

// Edit capital
router.put('/capital', authenticateToken, async (req, res) => {
  try {
    const { amount_usd = 0, amount_lbp = 0, account_type = 'cash', description = 'Capital adjustment' } = req.body;
    const userId = req.user.id;
    
    const current = await getCashboxData();
    
    // Calculate the difference
    const usdDiff = Number(amount_usd) - Number(current.initial_capital_usd);
    const lbpDiff = Number(amount_lbp) - Number(current.initial_capital_lbp);
    
    // Update cashbox
    const updates = {
      initial_capital_usd: Number(amount_usd),
      initial_capital_lbp: Number(amount_lbp),
      capital_set_at: new Date().toISOString(),
      capital_set_by: userId,
      updated_at: new Date().toISOString()
    };
    
    // Apply the difference to the selected account
    if (account_type === 'cash') {
      updates.cash_balance_usd = Number(current.cash_balance_usd) + usdDiff;
      updates.cash_balance_lbp = Number(current.cash_balance_lbp) + lbpDiff;
      updates.wish_balance_usd = Number(current.wish_balance_usd);
      updates.wish_balance_lbp = Number(current.wish_balance_lbp);
    } else if (account_type === 'wish') {
      updates.cash_balance_usd = Number(current.cash_balance_usd);
      updates.cash_balance_lbp = Number(current.cash_balance_lbp);
      updates.wish_balance_usd = Number(current.wish_balance_usd) + usdDiff;
      updates.wish_balance_lbp = Number(current.wish_balance_lbp) + lbpDiff;
    }
    
    // Main balance is always the sum of cash + wish
    updates.balance_usd = updates.cash_balance_usd + updates.wish_balance_usd;
    updates.balance_lbp = updates.cash_balance_lbp + updates.wish_balance_lbp;
    
    await mcp.update('cashbox', 1, updates);
    
    // Create cashbox entry for capital edit
    await mcp.create('cashbox_entries', {
      entry_type: 'capital_edit',
      amount_usd: usdDiff,
      amount_lbp: lbpDiff,
      account_type,
      description,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Capital updated successfully',
      data: updatedCashbox
    });
  } catch (error) {
    console.error('Error updating capital:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update capital',
      error: error.message
    });
  }
});

// Add income
router.post('/income', authenticateToken, async (req, res) => {
  try {
    const { 
      amount_usd = 0, 
      amount_lbp = 0, 
      description, 
      account_type = 'cash',
      notes = '',
      order_id = null
    } = req.body;
    
    const userId = req.user.id;
    
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }
    
    // Update cashbox balances
    await updateCashboxBalances(amount_usd, amount_lbp, account_type);
    
    // Create cashbox entry
    await mcp.create('cashbox_entries', {
      entry_type: 'income',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type,
      description,
      notes,
      order_id,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Income added successfully',
      data: updatedCashbox
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

// Add expense
router.post('/expense', authenticateToken, async (req, res) => {
  try {
    const { 
      amount_usd = 0, 
      amount_lbp = 0, 
      description, 
      account_type = 'cash',
      category = '',
      subcategory = '',
      notes = ''
    } = req.body;
    
    const userId = req.user.id;
    
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }
    
    // Update cashbox balances (subtract for expenses)
    await updateCashboxBalances(-amount_usd, -amount_lbp, account_type);
    
    // Create cashbox entry
    await mcp.create('cashbox_entries', {
      entry_type: 'expense',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type,
      category,
      subcategory,
      description,
      notes,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Expense added successfully',
      data: updatedCashbox
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

// Get expense categories
router.get('/expense-categories', authenticateToken, async (req, res) => {
  try {
    const categories = await mcp.queryWithJoins('SELECT * FROM expense_categories ORDER BY title');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense categories',
      error: error.message
    });
  }
});

// Expense capital (remove from cash or wish)
router.post('/expense-capital', authenticateToken, async (req, res) => {
  try {
    const { 
      amount_usd = 0, 
      amount_lbp = 0, 
      account_type = 'cash', // 'cash' or 'wish'
      description = 'Capital Expense',
      category_id = null
    } = req.body;

    if (amount_usd <= 0 && amount_lbp <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!['cash', 'wish'].includes(account_type)) {
      return res.status(400).json({
        success: false,
        message: 'Account type must be either cash or wish'
      });
    }
    
    // Update cashbox balances (subtract for capital expenses)
    await updateCashboxBalances(-amount_usd, -amount_lbp, account_type);
    
    // Create cashbox entry
    await mcp.create('cashbox_entries', {
      entry_type: 'capital_expense',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type,
      description,
      category_id,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Capital expense recorded successfully',
      data: updatedCashbox
    });
  } catch (error) {
    console.error('Error recording capital expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record capital expense',
      error: error.message
    });
  }
});

// Transfer between accounts (cash <-> wish)
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { 
      amount_usd = 0, 
      amount_lbp = 0, 
      from_account, 
      to_account, 
      description = 'Account transfer'
    } = req.body;
    
    const userId = req.user.id;
    
    if (!from_account || !to_account || from_account === to_account) {
      return res.status(400).json({
        success: false,
        message: 'Valid from_account and to_account are required'
      });
    }
    
    // Subtract from source account
    await updateCashboxBalances(-amount_usd, -amount_lbp, from_account);
    
    // Add to destination account
    await updateCashboxBalances(amount_usd, amount_lbp, to_account);
    
    // Create entries for both sides of transfer
    await mcp.create('cashbox_entries', {
      entry_type: 'cash_out',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type: from_account,
      description: `Transfer to ${to_account}: ${description}`,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    await mcp.create('cashbox_entries', {
      entry_type: 'cash_in',
      amount_usd: Number(amount_usd),
      amount_lbp: Number(amount_lbp),
      account_type: to_account,
      description: `Transfer from ${from_account}: ${description}`,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    const updatedCashbox = await getCashboxData();
    
    res.json({
      success: true,
      message: 'Transfer completed successfully',
      data: updatedCashbox
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process transfer',
      error: error.message
    });
  }
});

// Get detailed cashbox report
router.get('/report', authenticateToken, async (req, res) => {
  try {
    const { from, to, account_type = 'all' } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    let paramIndex = 1;
    
    if (from) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    
    if (to) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    
    if (account_type !== 'all') {
      whereClause += ` AND account_type = $${paramIndex}`;
      params.push(account_type);
      paramIndex++;
    }
    
    const entries = await mcp.queryWithJoins(`
      SELECT 
        entry_type,
        account_type,
        category,
        subcategory,
        SUM(amount_usd) as total_usd,
        SUM(amount_lbp) as total_lbp,
        COUNT(*) as count
      FROM cashbox_entries
      ${whereClause}
      GROUP BY entry_type, account_type, category, subcategory
      ORDER BY entry_type, category, subcategory
    `, params);
    
    const cashboxData = await getCashboxData();
    
    res.json({
      success: true,
      data: {
        summary: cashboxData,
        breakdown: entries
      }
    });
  } catch (error) {
    console.error('Error generating cashbox report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

module.exports = router;
