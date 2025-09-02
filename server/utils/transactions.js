const pool = require('../config/database');

// Get current exchange rate
const getCurrentExchangeRate = async () => {
  try {
    const result = await pool.query(
      'SELECT rate_usd_to_lbp FROM exchange_rates WHERE active = true ORDER BY created_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return 89000; // Default rate if none found
    }
    
    return parseFloat(result.rows[0].rate_usd_to_lbp);
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    return 89000; // Default fallback
  }
};

// Create a transaction
const createTransaction = async (transactionData) => {
  try {
    const {
      tx_type,
      reference_id,
      reference_table,
      details,
      amount_usd = 0,
      amount_lbp = 0,
      exchange_rate,
      debit_account,
      credit_account,
      created_by
    } = transactionData;

    // Get current exchange rate if not provided
    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate) {
      finalExchangeRate = await getCurrentExchangeRate();
    }

    // Calculate missing currency amount if only one is provided
    let finalAmountUsd = amount_usd;
    let finalAmountLbp = amount_lbp;

    if (amount_usd > 0 && amount_lbp === 0) {
      finalAmountLbp = Math.round(amount_usd * finalExchangeRate);
    } else if (amount_lbp > 0 && amount_usd === 0) {
      finalAmountUsd = Math.round((amount_lbp / finalExchangeRate) * 100) / 100;
    }

    const result = await pool.query(
      `INSERT INTO transactions (
        tx_type, reference_id, reference_table, details, amount_usd, 
        amount_lbp, exchange_rate, debit_account, credit_account, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        tx_type, reference_id, reference_table, details, finalAmountUsd,
        finalAmountLbp, finalExchangeRate, debit_account, credit_account, created_by
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
};

// Create cashbox entry
const createCashboxEntry = async (entryData) => {
  try {
    const {
      entry_type,
      amount_usd = 0,
      amount_lbp = 0,
      exchange_rate,
      actor_type,
      actor_id,
      notes,
      created_by
    } = entryData;

    // Get current exchange rate if not provided
    let finalExchangeRate = exchange_rate;
    if (!finalExchangeRate) {
      finalExchangeRate = await getCurrentExchangeRate();
    }

    // Calculate missing currency amount if only one is provided
    let finalAmountUsd = amount_usd;
    let finalAmountLbp = amount_lbp;

    if (amount_usd > 0 && amount_lbp === 0) {
      finalAmountLbp = Math.round(amount_usd * finalExchangeRate);
    } else if (amount_lbp > 0 && amount_usd === 0) {
      finalAmountUsd = Math.round((amount_lbp / finalExchangeRate) * 100) / 100;
    }

    const result = await pool.query(
      `INSERT INTO cashbox_entries (
        entry_type, amount_usd, amount_lbp, exchange_rate, 
        actor_type, actor_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        entry_type, finalAmountUsd, finalAmountLbp, finalExchangeRate,
        actor_type, actor_id, notes, created_by
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating cashbox entry:', error);
    throw error;
  }
};

// Get cashbox balance
const getCashboxBalance = async () => {
  try {
    const result = await pool.query(`
      SELECT 
        SUM(CASE WHEN entry_type IN ('cash_in', 'driver_return') THEN amount_usd ELSE -amount_usd END) as balance_usd,
        SUM(CASE WHEN entry_type IN ('cash_in', 'driver_return') THEN amount_lbp ELSE -amount_lbp END) as balance_lbp
      FROM cashbox_entries
    `);

    const balance = result.rows[0];
    return {
      balance_usd: parseFloat(balance.balance_usd || 0),
      balance_lbp: parseInt(balance.balance_lbp || 0)
    };
  } catch (error) {
    console.error('Error getting cashbox balance:', error);
    return { balance_usd: 0, balance_lbp: 0 };
  }
};

// Get driver balance
const getDriverBalance = async (driverId) => {
  try {
    const result = await pool.query(`
      SELECT 
        SUM(CASE WHEN entry_type = 'driver_advance' THEN amount_usd ELSE -amount_usd END) as balance_usd,
        SUM(CASE WHEN entry_type = 'driver_advance' THEN amount_lbp ELSE -amount_lbp END) as balance_lbp
      FROM cashbox_entries
      WHERE actor_type = 'driver' AND actor_id = $1
    `, [driverId]);

    const balance = result.rows[0];
    return {
      balance_usd: parseFloat(balance.balance_usd || 0),
      balance_lbp: parseInt(balance.balance_lbp || 0)
    };
  } catch (error) {
    console.error('Error getting driver balance:', error);
    return { balance_usd: 0, balance_lbp: 0 };
  }
};

// Process order payment
const processOrderPayment = async (orderId, paymentData) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      payment_method,
      notes,
      created_by
    } = paymentData;

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    // Create payment transaction
    await createTransaction({
      tx_type: 'order_payment',
      reference_id: orderId,
      reference_table: 'orders',
      details: { 
        order_ref: order.order_ref,
        payment_method,
        notes
      },
      amount_usd,
      amount_lbp,
      debit_account: 'cashbox',
      credit_account: 'orders_receivable',
      created_by
    });

    // Create cashbox entry
    await createCashboxEntry({
      entry_type: 'cash_in',
      amount_usd,
      amount_lbp,
      actor_type: 'client',
      actor_id: null,
      notes: `Payment for order ${order.order_ref}`,
      created_by
    });

    // Update order payment status
    let newPaymentStatus = 'partial';
    if (amount_usd >= order.total_usd && amount_lbp >= order.total_lbp) {
      newPaymentStatus = 'paid';
    }

    await pool.query(
      'UPDATE orders SET payment_status = $1 WHERE id = $2',
      [newPaymentStatus, orderId]
    );

    return { success: true, newPaymentStatus };
  } catch (error) {
    console.error('Error processing order payment:', error);
    throw error;
  }
};

// Process driver payment/advance
const processDriverPayment = async (driverId, paymentData) => {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      payment_type, // 'advance' or 'return'
      notes,
      created_by
    } = paymentData;

    const entryType = payment_type === 'return' ? 'driver_return' : 'driver_advance';

    // Create cashbox entry
    await createCashboxEntry({
      entry_type: entryType,
      amount_usd,
      amount_lbp,
      actor_type: 'driver',
      actor_id: driverId,
      notes,
      created_by
    });

    // Create transaction
    await createTransaction({
      tx_type: `driver_${payment_type}`,
      reference_id: driverId,
      reference_table: 'drivers',
      details: { 
        payment_type,
        notes
      },
      amount_usd,
      amount_lbp,
      debit_account: payment_type === 'advance' ? 'driver_payable' : 'cashbox',
      credit_account: payment_type === 'advance' ? 'cashbox' : 'driver_payable',
      created_by
    });

    return { success: true };
  } catch (error) {
    console.error('Error processing driver payment:', error);
    throw error;
  }
};

// Get transaction summary by type
const getTransactionSummary = async (filters = {}) => {
  try {
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (filters.tx_type) {
      paramCount++;
      whereClause += ` AND tx_type = $${paramCount}`;
      params.push(filters.tx_type);
    }

    if (filters.actor_type) {
      paramCount++;
      whereClause += ` AND actor_type = $${paramCount}`;
      params.push(filters.actor_type);
    }

    if (filters.from_date) {
      paramCount++;
      whereClause += ` AND DATE(created_at) >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      whereClause += ` AND DATE(created_at) <= $${paramCount}`;
      params.push(filters.to_date);
    }

    const result = await pool.query(`
      SELECT 
        tx_type,
        COUNT(*) as count,
        SUM(amount_usd) as total_usd,
        SUM(amount_lbp) as total_lbp
      FROM transactions
      ${whereClause}
      GROUP BY tx_type
      ORDER BY total_usd DESC, total_lbp DESC
    `, params);

    return result.rows;
  } catch (error) {
    console.error('Error getting transaction summary:', error);
    return [];
  }
};

module.exports = {
  createTransaction,
  createCashboxEntry,
  getCashboxBalance,
  getDriverBalance,
  processOrderPayment,
  processDriverPayment,
  getTransactionSummary,
  getCurrentExchangeRate
};
