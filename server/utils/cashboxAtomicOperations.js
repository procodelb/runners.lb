const { pool } = require('../config/database');
const mcp = require('../mcp');

/**
 * Atomic Cashbox Operations with Row-Level Locking
 * Implements the authoritative cashbox rules with proper transaction handling
 */

/**
 * Get cashbox data with row-level lock for atomic updates
 * This ensures no race conditions when multiple operations happen simultaneously
 */
async function getLockedCashbox(client) {
  const result = await client.query(
    'SELECT * FROM cashbox WHERE id = 1 FOR UPDATE'
  );
  if (!result.rows || result.rows.length === 0) {
    throw new Error('Cashbox not found. Please ensure cashbox table has a row with id=1');
  }
  return result.rows[0];
}

/**
 * Update cashbox balances atomically
 */
async function updateCashboxBalances(client, usdDelta, lbpDelta, accountType = 'cash') {
  const cashbox = await getLockedCashbox(client);
  
  const updates = {
    updated_at: new Date().toISOString()
  };
  
  // Update specific account balance
  if (accountType === 'cash') {
    updates.cash_balance_usd = Number(cashbox.cash_balance_usd) + Number(usdDelta);
    updates.cash_balance_lbp = Number(cashbox.cash_balance_lbp) + Number(lbpDelta);
    updates.wish_balance_usd = Number(cashbox.wish_balance_usd);
    updates.wish_balance_lbp = Number(cashbox.wish_balance_lbp);
  } else if (accountType === 'wish') {
    updates.cash_balance_usd = Number(cashbox.cash_balance_usd);
    updates.cash_balance_lbp = Number(cashbox.cash_balance_lbp);
    updates.wish_balance_usd = Number(cashbox.wish_balance_usd) + Number(usdDelta);
    updates.wish_balance_lbp = Number(cashbox.wish_balance_lbp) + Number(lbpDelta);
  }
  
  // Main balance is always the sum of cash + wish
  updates.balance_usd = updates.cash_balance_usd + updates.wish_balance_usd;
  updates.balance_lbp = updates.cash_balance_lbp + updates.wish_balance_lbp;
  
  // Update with parameterized query
  await client.query(
    `UPDATE cashbox 
     SET cash_balance_usd = $1, cash_balance_lbp = $2, 
         wish_balance_usd = $3, wish_balance_lbp = $4,
         balance_usd = $5, balance_lbp = $6,
         updated_at = $7
     WHERE id = 1`,
    [
      updates.cash_balance_usd,
      updates.cash_balance_lbp,
      updates.wish_balance_usd,
      updates.wish_balance_lbp,
      updates.balance_usd,
      updates.balance_lbp,
      updates.updated_at
    ]
  );
  
  return updates;
}

/**
 * Create cashbox entry within a transaction
 */
async function createCashboxEntry(client, entryData) {
  try {
    const {
      entry_type,
      amount_usd = 0,
      amount_lbp = 0,
      actor_type,
      actor_id,
      order_id,
      description,
      account_type = 'cash',
      category,
      subcategory,
      notes,
      created_by
    } = entryData;
    
    // Validate required fields
    if (!entry_type || !actor_type) {
      throw new Error('entry_type and actor_type are required');
    }
    
    const result = await client.query(
      `INSERT INTO cashbox_entries 
       (entry_type, amount_usd, amount_lbp, actor_type, actor_id, order_id, 
        description, account_type, category, subcategory, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       RETURNING *`,
      [
        entry_type, amount_usd || 0, amount_lbp || 0, actor_type, actor_id || null, order_id || null,
        description || '', account_type, category || null, subcategory || null, notes || null, created_by
      ]
    );
    
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Failed to create cashbox entry - no data returned');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error in createCashboxEntry:', {
      message: error.message,
      entryData: JSON.stringify(entryData).substring(0, 200)
    });
    throw error;
  }
}

/**
 * Create accounting transaction within a transaction
 */
async function createTransaction(client, txData) {
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
    created_by
  } = txData;
  
  const result = await client.query(
    `INSERT INTO transactions 
     (tx_type, amount_usd, amount_lbp, actor_type, actor_id, 
      debit_account, credit_account, description, order_id, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     RETURNING *`,
    [
      tx_type, amount_usd, amount_lbp, actor_type, actor_id,
      debit_account, credit_account, description, order_id, created_by
    ]
  );
  
  return result.rows[0];
}

/**
 * Get exchange rate within a transaction
 */
async function getExchangeRate(client) {
  const result = await client.query(
    'SELECT lbp_per_usd FROM exchange_rates ORDER BY effective_at DESC LIMIT 1'
  );
  const rate = result.rows[0]?.lbp_per_usd;
  return rate ? Number(rate) : 89000; // Default rate
}

/**
 * Compute both USD and LBP amounts based on exchange rate
 */
async function computeBothCurrencies(client, usdAmount, lbpAmount) {
  const rate = await getExchangeRate(client);
  
  let totalUsd = Number(usdAmount || 0);
  let totalLbp = Number(lbpAmount || 0);
  
  // If only one currency provided, compute the other
  if (totalUsd > 0 && totalLbp === 0) {
    totalLbp = Math.round(totalUsd * rate);
  } else if (totalLbp > 0 && totalUsd === 0) {
    totalUsd = Math.round((totalLbp / rate) * 100) / 100;
  }
  
  return { totalUsd, totalLbp };
}

/**
 * Check if order should trigger cash out on creation
 */
function shouldCashOutOnCreate(order) {
  // Prepaid orders when payment_status is 'prepaid' or 'paid' at creation for ecommerce orders
  if ((order.payment_status === 'prepaid' || order.payment_status === 'paid') && order.type === 'ecommerce') {
    return true;
  }
  
  // Go-to-market orders (is_purchase = true)
  if (order.is_purchase === true || order.type === 'go_to_market') {
    return true;
  }
  
  return false;
}

/**
 * Process order cashbox deduction (cash out on creation)
 * This happens for prepaid orders or go-to-market orders
 */
async function processOrderCashDeduction(client, orderId, order, userId) {
  try {
    // Check if already applied (handle missing column gracefully)
    if (order.cashbox_applied_on_create === true) {
      console.log(`⚠️ Order ${order.order_ref || orderId} already has cash deduction applied`);
      return null;
    }
    
    // Validate required data
    if (!orderId || !order || !userId) {
      throw new Error('Missing required parameters for cash deduction');
    }
    
    // Compute amounts in both currencies
    let totalUsd = 0;
    let totalLbp = 0;
    try {
      const computed = await computeBothCurrencies(
        client,
        order.total_usd || 0,
        order.total_lbp || 0
      );
      totalUsd = computed.totalUsd || 0;
      totalLbp = computed.totalLbp || 0;
    } catch (computeError) {
      console.error('Error computing currencies, using direct values:', computeError);
      totalUsd = parseFloat(order.total_usd) || 0;
      totalLbp = parseInt(order.total_lbp) || 0;
    }
    
    if (totalUsd === 0 && totalLbp === 0) {
      console.log(`⚠️ Order ${order.order_ref || orderId} has zero amounts, skipping cash deduction`);
      return null;
    }
    
    // Update cashbox balances
    try {
      await updateCashboxBalances(client, -totalUsd, -totalLbp, 'cash');
    } catch (cashboxError) {
      console.error('Error updating cashbox balances:', cashboxError);
      throw new Error(`Failed to update cashbox: ${cashboxError.message}`);
    }
    
    // Create cashbox entry
    let entry = null;
    try {
      entry = await createCashboxEntry(client, {
        entry_type: 'order_cash_out',
        amount_usd: totalUsd,
        amount_lbp: totalLbp,
        actor_type: 'order',
        actor_id: orderId,
        order_id: orderId,
        description: `Cash out for ${order.type || 'order'} order ${order.order_ref || orderId}`,
        account_type: 'cash',
        created_by: userId
      });
    } catch (entryError) {
      console.error('Error creating cashbox entry:', entryError);
      // Log but continue - entry creation is not critical
    }
    
    // Create accounting transaction
    try {
      await createTransaction(client, {
        tx_type: 'order_payment',
        amount_usd: totalUsd,
        amount_lbp: totalLbp,
        actor_type: 'order',
        actor_id: orderId,
        debit_account: 'operating_expense',
        credit_account: 'cash_account',
        description: `Prepayment for order ${order.order_ref || orderId}`,
        order_id: orderId,
        created_by: userId
      });
    } catch (txError) {
      console.error('Error creating transaction:', txError);
      // Log but continue - transaction creation is not critical
    }
    
    // Mark as applied (handle missing column gracefully)
    try {
      await client.query(
        'UPDATE orders SET cashbox_applied_on_create = true WHERE id = $1',
        [orderId]
      );
    } catch (updateError) {
      // Column might not exist - check error
      if (updateError.message && updateError.message.includes('does not exist')) {
        console.warn('⚠️ cashbox_applied_on_create column does not exist - skipping flag update');
      } else {
        throw updateError;
      }
    }
    
    console.log(`💰 Cash out applied: $${totalUsd} / ${totalLbp} LBP for order ${order.order_ref || orderId}`);
    
    return { totalUsd, totalLbp, entry };
  } catch (error) {
    console.error(`❌ Error in processOrderCashDeduction for order ${order?.order_ref || orderId}:`, {
      message: error.message,
      stack: error.stack,
      orderId,
      userId,
      orderType: order?.type
    });
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Process order cashbox credit (cash in on delivery or when paid)
 */
async function processOrderCashCredit(client, orderId, order, userId, reason = 'delivery') {
  // Check if already applied
  if (order.cashbox_applied_on_delivery && reason === 'delivery') {
    console.log(`⚠️ Order ${order.order_ref} already has delivery cash credit applied`);
    return null;
  }
  
  if (order.cashbox_applied_on_paid && reason === 'paid') {
    console.log(`⚠️ Order ${order.order_ref} already has paid cash credit applied`);
    return null;
  }
  
  // Compute amounts in both currencies
  const { totalUsd, totalLbp } = await computeBothCurrencies(
    client,
    order.total_usd,
    order.total_lbp
  );
  
  if (totalUsd === 0 && totalLbp === 0) {
    return null;
  }
  
  // Update cashbox balances
  await updateCashboxBalances(client, totalUsd, totalLbp, 'cash');
  
  // Create cashbox entry
  const entry = await createCashboxEntry(client, {
    entry_type: 'order_cash_in',
    amount_usd: totalUsd,
    amount_lbp: totalLbp,
    actor_type: 'order',
    actor_id: orderId,
    order_id: orderId,
    description: `Cash in for ${reason} order ${order.order_ref || orderId}`,
    account_type: 'cash',
    created_by: userId
  });
  
  // Create accounting transaction
  await createTransaction(client, {
    tx_type: 'order_payment',
    amount_usd: totalUsd,
    amount_lbp: totalLbp,
    actor_type: 'order',
    actor_id: orderId,
    debit_account: 'cash_account',
    credit_account: 'revenue',
    description: `Payment received for ${reason} order ${order.order_ref || orderId}`,
    order_id: orderId,
    created_by: userId
  });
  
  // Mark as applied
  if (reason === 'delivery') {
    await client.query(
      'UPDATE orders SET cashbox_applied_on_delivery = true WHERE id = $1',
      [orderId]
    );
  } else if (reason === 'paid') {
    await client.query(
      'UPDATE orders SET cashbox_applied_on_paid = true WHERE id = $1',
      [orderId]
    );
  }
  
  console.log(`💰 Cash in applied: $${totalUsd} / ${totalLbp} LBP for order ${order.order_ref} (${reason})`);
  
  return { totalUsd, totalLbp, entry };
}

/**
 * Process client cashout (deduct from cashbox for regular orders, credit for prepaid orders)
 */
async function processClientCashout(client, cashoutData) {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      client_id,
      order_ids = [],
      userId,
      description
    } = cashoutData;
    
    // Validate required fields
    if (!userId) {
      throw new Error('userId is required for cashout');
    }
    
    // Compute amounts in both currencies
    const { totalUsd, totalLbp } = await computeBothCurrencies(
      client,
      amount_usd,
      amount_lbp
    );
    
    // Check if orders are prepaid (have cashbox_applied_on_create = true)
    // Prepaid orders already had money deducted on creation, so we should RETURN it, not deduct again
    let isPrepaidCashout = false;
    if (order_ids.length > 0) {
      try {
        // Check database type for proper array query syntax
        // Note: If using pool.connect(), we're always using PostgreSQL
        // So we use PostgreSQL syntax directly
        const ordersResult = await client.query(
          `SELECT cashbox_applied_on_create, payment_status, type, is_purchase 
           FROM orders 
           WHERE id = ANY($1)`,
          [order_ids]
        );
        
        // Check if all orders are prepaid (had cash deducted on creation)
        // Use the same logic as shouldCashOutOnCreate to identify prepaid orders:
        // 1. Orders with cashbox_applied_on_create = true (definitely prepaid)
        // 2. Ecommerce/instant orders with payment_status = 'prepaid' or 'paid'
        // 3. Go-to-market orders (is_purchase = true or type = 'go_to_market')
        const allPrepaid = ordersResult.rows.length > 0 && ordersResult.rows.every(order => {
          // If flag is set, definitely prepaid
          if (order.cashbox_applied_on_create === true) {
            return true;
          }
          
          // Check if it matches prepaid creation criteria
          const isPrepaidEcommerce = ((order.payment_status === 'prepaid' || order.payment_status === 'paid' || order.payment_status === 'Paid') && 
                                       (order.type === 'ecommerce' || order.type === 'instant'));
          const isGoToMarket = order.is_purchase === true || order.type === 'go_to_market';
          
          return isPrepaidEcommerce || isGoToMarket;
        });
        
        if (allPrepaid) {
          isPrepaidCashout = true;
          console.log(`💰 Detected prepaid order cashout - will RETURN money to cash account`);
        }
      } catch (queryError) {
        // If query fails due to missing columns, log and continue with regular cashout
        if (queryError.message && queryError.message.includes('does not exist')) {
          console.warn('⚠️ Some columns missing in orders table - assuming regular cashout:', queryError.message);
          isPrepaidCashout = false;
        } else {
          throw queryError;
        }
      }
    }
    
    // For prepaid orders: CREDIT (add) money back to cashbox (since it was already deducted on creation)
    // For regular orders: DEBIT (deduct) money from cashbox
    const cashDeltaUsd = isPrepaidCashout ? totalUsd : -totalUsd;
    const cashDeltaLbp = isPrepaidCashout ? totalLbp : -totalLbp;
    
    await updateCashboxBalances(client, cashDeltaUsd, cashDeltaLbp, 'cash');
    
    // Create cashbox entry with appropriate type
    const order_id = order_ids.length === 1 ? order_ids[0] : null; // Single order cashout gets order_id
    const entry = await createCashboxEntry(client, {
      entry_type: isPrepaidCashout ? 'prepaid_cashout' : 'client_cashout',
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      actor_type: 'client',
      actor_id: client_id || null,
      order_id: order_id,
      description: isPrepaidCashout 
        ? `Prepaid order cashout - Return ${totalUsd} USD / ${totalLbp} LBP to cash account`
        : description || `Client cashout ${totalUsd} USD / ${totalLbp} LBP`,
      account_type: 'cash',
      created_by: userId
    });
    
    // Create accounting transaction
    // For prepaid: cash_account is credited (money returned)
    // For regular: cash_account is debited (money paid out)
    await createTransaction(client, {
      tx_type: 'client_payment',
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      actor_type: 'client',
      actor_id: client_id || null,
      order_id: order_id,
      debit_account: isPrepaidCashout ? 'client_payable' : 'cash_account',
      credit_account: isPrepaidCashout ? 'cash_account' : 'client_payable',
      description: isPrepaidCashout 
        ? `Prepaid order cashout - Money returned to cash account`
        : description || `Client cashout`,
      created_by: userId
    });
    
    // Mark orders as moved to history (handle missing columns gracefully)
    if (order_ids.length > 0) {
      try {
        // Using pool.connect() means we're always using PostgreSQL
        // So we use PostgreSQL syntax directly
        await client.query(
          `UPDATE orders SET cashbox_history_moved = true, accounting_cashed = true WHERE id = ANY($1)`,
          [order_ids]
        );
      } catch (updateError) {
        // If columns don't exist, try updating only accounting_cashed
        if (updateError.message && updateError.message.includes('does not exist')) {
          console.warn('⚠️ Some columns missing - trying alternative update');
          try {
            // Using pool.connect() means we're always using PostgreSQL
            await client.query(
              `UPDATE orders SET accounting_cashed = true WHERE id = ANY($1)`,
              [order_ids]
            );
          } catch (altError) {
            console.error('Error updating orders:', altError);
            // Continue even if update fails - cashout is already processed
          }
        } else {
          throw updateError;
        }
      }
    }
    
    console.log(`💰 Client cashout: $${totalUsd} / ${totalLbp} LBP ${isPrepaidCashout ? '(RETURNED to cash - prepaid)' : '(deducted from cash)'}`);
    
    return { totalUsd, totalLbp, entry, isPrepaidCashout };
  } catch (error) {
    console.error('❌ Error in processClientCashout:', {
      message: error.message,
      stack: error.stack,
      cashoutData: {
        amount_usd: cashoutData?.amount_usd,
        amount_lbp: cashoutData?.amount_lbp,
        client_id: cashoutData?.client_id,
        order_ids: cashoutData?.order_ids,
        userId: cashoutData?.userId ? 'provided' : 'missing'
      }
    });
    throw error;
  }
}

/**
 * Process driver cashout (add driver fees to cash account)
 * When driver orders are cashed out, the driver fees we collected from clients
 * are added to our cash account as income
 */
async function processDriverCashout(client, cashoutData) {
  try {
    const {
      amount_usd = 0,
      amount_lbp = 0,
      driver_id,
      order_ids = [],
      userId,
      description
    } = cashoutData;
    
    // Validate required fields
    if (!userId) {
      throw new Error('userId is required for cashout');
    }
    
    if (!driver_id) {
      throw new Error('driver_id is required for driver cashout');
    }
    
    // Compute amounts in both currencies
    const { totalUsd, totalLbp } = await computeBothCurrencies(
      client,
      amount_usd,
      amount_lbp
    );
    
    // Validate amounts
    if (totalUsd === 0 && totalLbp === 0) {
      throw new Error('Driver cashout amounts cannot be zero');
    }
    
    // Driver cashout: ADD fees to cash account (income - we collected from clients)
    // This is money we collected from clients that includes driver fees
    console.log(`💰 Adding driver fees to cashbox: ${totalUsd} USD / ${totalLbp} LBP`);
    
    // CRITICAL: Update cashbox balance FIRST before creating entry
    // This ensures the balance is updated atomically
    const balanceUpdate = await updateCashboxBalances(client, totalUsd, totalLbp, 'cash');
    console.log(`✅ Cashbox balances updated successfully:`, {
      cash_balance_usd: balanceUpdate.cash_balance_usd,
      cash_balance_lbp: balanceUpdate.cash_balance_lbp,
      delta_usd: totalUsd,
      delta_lbp: totalLbp
    });
    
    // Create cashbox entry for driver fee income
    // Use 'cash_in' as entry_type (this is the correct type per schema)
    const order_id = order_ids.length === 1 ? order_ids[0] : null;
    const entryDescription = description || `Driver fee income from order: ${order_id ? `Order ${order_id}` : 'Driver cashout'} - ${totalUsd} USD / ${totalLbp} LBP`;
    
    // Always use 'cash_in' - this is the correct entry type for driver fee income
    const entry = await createCashboxEntry(client, {
      entry_type: 'cash_in',
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      actor_type: 'driver',
      actor_id: driver_id,
      order_id: order_id,
      description: entryDescription,
      account_type: 'cash',
      category: 'Operations / Fleet',
      subcategory: 'Driver Fee Income',
      created_by: userId
    });
    console.log(`✅ Cashbox entry created: ID ${entry.id}, Type: cash_in, Amount: ${totalUsd} USD / ${totalLbp} LBP`);
    
    // Create accounting transaction
    // Credit cash_account (money received), Debit driver_payable (money we owe to driver)
    await createTransaction(client, {
      tx_type: 'driver_fee_collection',
      amount_usd: totalUsd,
      amount_lbp: totalLbp,
      actor_type: 'driver',
      actor_id: driver_id,
      order_id: order_id,
      debit_account: 'driver_payable',
      credit_account: 'cash_account',
      description: description || `Driver fee collected and added to cash account`,
      created_by: userId
    });
    
    // Mark orders as cashed out
    if (order_ids.length > 0) {
      try {
        await client.query(
          `UPDATE orders SET accounting_cashed = true, updated_at = now() WHERE id = ANY($1)`,
          [order_ids]
        );
      } catch (updateError) {
        // If columns don't exist, try alternative update
        if (updateError.message && updateError.message.includes('does not exist')) {
          console.warn('⚠️ Some columns missing - trying alternative update');
          try {
            await client.query(
              `UPDATE orders SET accounting_cashed = true WHERE id = ANY($1)`,
              [order_ids]
            );
          } catch (altError) {
            console.error('Error updating orders:', altError);
            // Continue even if update fails - cashout is already processed
          }
        } else {
          throw updateError;
        }
      }
    }
    
    console.log(`💰 Driver cashout: $${totalUsd} / ${totalLbp} LBP added to cash account`);
    
    return { totalUsd, totalLbp, entry };
  } catch (error) {
    console.error('❌ Error in processDriverCashout:', {
      message: error.message,
      stack: error.stack,
      cashoutData: {
        amount_usd: cashoutData?.amount_usd,
        amount_lbp: cashoutData?.amount_lbp,
        driver_id: cashoutData?.driver_id,
        order_ids: cashoutData?.order_ids,
        userId: cashoutData?.userId ? 'provided' : 'missing'
      }
    });
    throw error;
  }
}

module.exports = {
  getLockedCashbox,
  updateCashboxBalances,
  createCashboxEntry,
  createTransaction,
  getExchangeRate,
  computeBothCurrencies,
  shouldCashOutOnCreate,
  processOrderCashDeduction,
  processOrderCashCredit,
  processClientCashout,
  processDriverCashout
};

