const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all drivers with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      active = 'all',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions
    let filterConditions = [];
    let filterParams = [];

    if (search) {
      filterConditions.push(`(full_name LIKE ? OR phone LIKE ? OR address LIKE ?)`);
      filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Handle active filter
    if (active !== 'all') {
      filterConditions.push(`active = ?`);
      filterParams.push(active === 'active' ? true : false);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM drivers ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = countResult[0]?.count || 0;

    // Get drivers with pagination
    const driversQuery = `
      SELECT * FROM drivers
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const driversResult = await query(driversQuery, filterParams);

    res.json({
      success: true,
      data: driversResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch drivers',
      error: error.message 
    });
  }
});

// Get single driver
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number to prevent search parameter confusion
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid driver ID. ID must be a number.' 
      });
    }
    
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const result = await query(driverQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch driver',
      error: error.message 
    });
  }
});

// Create new driver
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      address,
      notes,
      default_fee_lbp,
      default_fee_usd,
      active
    } = req.body;

    if (!full_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Full name is required' 
      });
    }

    const insertQuery = `
      INSERT INTO drivers (full_name, phone, address, notes, default_fee_lbp, default_fee_usd, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      full_name, 
      phone || null, 
      address || null, 
      notes || null,
      default_fee_lbp || 0,
      default_fee_usd || 0,
      active !== undefined ? active : 1
    ];
    const result = await run(insertQuery, params);

    // Fetch the created driver
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const driverResult = await query(driverQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driverResult[0]
    });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create driver',
      error: error.message 
    });
  }
});

// Update driver
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid driver ID. ID must be a number.' 
      });
    }
    
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateQuery = `UPDATE drivers SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    values.push(id);
    await run(updateQuery, values);

    // Fetch the updated driver
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const driverResult = await query(driverQuery, [id]);

    if (driverResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driverResult[0]
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update driver',
      error: error.message 
    });
  }
});

// Delete driver
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid driver ID. ID must be a number.' 
      });
    }
    
    const deleteQuery = 'DELETE FROM drivers WHERE id = ?';
    const result = await run(deleteQuery, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    res.json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete driver',
      error: error.message 
    });
  }
});

// Get driver orders
router.get('/:id/orders', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = '' } = req.query;
    
    let whereClause = 'WHERE driver_id = ?';
    let params = [id];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const ordersQuery = `
      SELECT * FROM orders
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    const result = await query(ordersQuery, params);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching driver orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch driver orders',
      error: error.message 
    });
  }
});

// Add driver fees (creates a transaction)
router.post('/:id/fees', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_lbp, amount_usd, description, type } = req.body;
    const userId = req.user.id;

    // Validate driver exists
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const driverResult = await query(driverQuery, [id]);
    
    if (driverResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    // Create transaction for driver fees
    const transactionQuery = `
      INSERT INTO transactions (type, amount_usd, amount_lbp, description, related_id, related_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const transactionParams = [
      type || 'driver_fee',
      amount_usd || 0,
      amount_lbp || 0,
      description || 'Driver fee',
      id,
      'driver',
      userId
    ];

    const result = await run(transactionQuery, transactionParams);

    res.status(201).json({
      success: true,
      message: 'Driver fees added successfully',
      data: { id: result.id }
    });
  } catch (error) {
    console.error('Error adding driver fees:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add driver fees',
      error: error.message 
    });
  }
});

// Get driver fees (transactions)
router.get('/:id/fees', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const feesQuery = `
      SELECT * FROM transactions 
      WHERE related_id = ? AND related_type = 'driver'
      ORDER BY created_at DESC
    `;
    
    const result = await query(feesQuery, [id]);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching driver fees:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch driver fees',
      error: error.message 
    });
  }
});

// Add driver advance (creates a cashbox entry)
router.post('/:id/advances', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_lbp, amount_usd, description } = req.body;
    const userId = req.user.id;

    // Validate driver exists
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const driverResult = await query(driverQuery, [id]);
    
    if (driverResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    // Create cashbox entry for driver advance
    const cashboxQuery = `
      INSERT INTO cashbox (type, amount_usd, amount_lbp, description, driver_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const cashboxParams = [
      'driver_advance',
      amount_usd || 0,
      amount_lbp || 0,
      description || 'Driver advance',
      id,
      userId
    ];

    const result = await run(cashboxQuery, cashboxParams);

    res.status(201).json({
      success: true,
      message: 'Driver advance added successfully',
      data: { id: result.id }
    });
  } catch (error) {
    console.error('Error adding driver advance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add driver advance',
      error: error.message 
    });
  }
});

// Get driver advances (cashbox entries)
router.get('/:id/advances', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const advancesQuery = `
      SELECT * FROM cashbox 
      WHERE driver_id = ? AND type = 'driver_advance'
      ORDER BY created_at DESC
    `;
    
    const result = await query(advancesQuery, [id]);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching driver advances:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch driver advances',
      error: error.message 
    });
  }
});

// Add driver expenses (creates a transaction and updates cashbox)
router.post('/:id/expenses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_lbp, amount_usd, description, category = 'fuel' } = req.body;
    const userId = req.user.id;

    // Validate driver exists
    const driverQuery = 'SELECT * FROM drivers WHERE id = ?';
    const driverResult = await query(driverQuery, [id]);
    
    if (driverResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    // Validate amounts
    if (!amount_lbp && !amount_usd) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either amount_lbp or amount_usd must be provided' 
      });
    }

    // Get current cashbox balance
    const cashboxQuery = 'SELECT balance_usd, balance_lbp FROM cashbox WHERE id = 1';
    const cashboxResult = await query(cashboxQuery);
    const currentBalance = cashboxResult[0] || { balance_usd: 0, balance_lbp: 0 };

    // Calculate amounts in both currencies if only one provided
    let finalAmountUsd = amount_usd || 0;
    let finalAmountLbp = amount_lbp || 0;

    if (amount_usd && !amount_lbp) {
      // Convert USD to LBP using exchange rate
      const exchangeRateQuery = 'SELECT lbp_per_usd FROM exchange_rates ORDER BY effective_at DESC LIMIT 1';
      const rateResult = await query(exchangeRateQuery);
      const rate = rateResult[0]?.lbp_per_usd || 89000;
      finalAmountLbp = Math.round(amount_usd * rate);
    } else if (amount_lbp && !amount_usd) {
      // Convert LBP to USD using exchange rate
      const exchangeRateQuery = 'SELECT lbp_per_usd FROM exchange_rates ORDER BY effective_at DESC LIMIT 1';
      const rateResult = await query(exchangeRateQuery);
      const rate = rateResult[0]?.lbp_per_usd || 89000;
      finalAmountUsd = Math.round((amount_lbp / rate) * 100) / 100;
    }

    // Check if cashbox has sufficient balance
    if (currentBalance.balance_usd < finalAmountUsd || currentBalance.balance_lbp < finalAmountLbp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient cashbox balance for this expense' 
      });
    }

    // Create transaction for driver expense
    const transactionQuery = `
      INSERT INTO transactions (tx_type, amount_usd, amount_lbp, actor_type, actor_id, description, category, direction, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const transactionParams = [
      'driver_expense',
      finalAmountUsd,
      finalAmountLbp,
      'driver',
      id,
      description || `${category} expense`,
      category,
      'debit',
      userId
    ];

    const transactionResult = await run(transactionQuery, transactionParams);

    // Update cashbox balance
    const newBalanceUsd = currentBalance.balance_usd - finalAmountUsd;
    const newBalanceLbp = currentBalance.balance_lbp - finalAmountLbp;
    
    const updateCashboxQuery = `
      UPDATE cashbox 
      SET balance_usd = ?, balance_lbp = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `;
    
    await run(updateCashboxQuery, [newBalanceUsd, newBalanceLbp]);

    // Create cashbox entry for tracking
    const cashboxEntryQuery = `
      INSERT INTO cashbox_entries (entry_type, amount_usd, amount_lbp, actor_type, actor_id, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await run(cashboxEntryQuery, [
      'driver_expense',
      finalAmountUsd,
      finalAmountLbp,
      'driver',
      id,
      description || `${category} expense`,
      userId
    ]);

    res.status(201).json({
      success: true,
      message: 'Driver expense added successfully',
      data: { 
        id: transactionResult.id,
        amount_usd: finalAmountUsd,
        amount_lbp: finalAmountLbp,
        category,
        description: description || `${category} expense`
      }
    });
  } catch (error) {
    console.error('Error adding driver expense:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add driver expense',
      error: error.message 
    });
  }
});

module.exports = router;
