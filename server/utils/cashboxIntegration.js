const mcp = require('../mcp');

/**
 * Utility functions for integrating orders and delivery fees with cashbox
 */

// Helper function to get cashbox data
async function getCashboxData() {
  try {
    const result = await mcp.queryWithJoins('SELECT * FROM cashbox WHERE id = 1');
    return result[0] || {
      id: 1,
      balance_usd: 0,
      balance_lbp: 0,
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
      balance_usd: Number(current.balance_usd) + Number(usdDelta),
      balance_lbp: Number(current.balance_lbp) + Number(lbpDelta),
      updated_at: new Date().toISOString()
    };
    
    // Update specific account balance
    if (accountType === 'cash') {
      updates.cash_balance_usd = Number(current.cash_balance_usd) + Number(usdDelta);
      updates.cash_balance_lbp = Number(current.cash_balance_lbp) + Number(lbpDelta);
    } else if (accountType === 'wish') {
      updates.wish_balance_usd = Number(current.wish_balance_usd) + Number(usdDelta);
      updates.wish_balance_lbp = Number(current.wish_balance_lbp) + Number(lbpDelta);
    }
    
    await mcp.update('cashbox', 1, updates);
    return await getCashboxData();
  } catch (error) {
    console.error('Error updating cashbox balances:', error);
    throw error;
  }
}

/**
 * Add order income to cashbox when order is completed and paid
 * @param {Object} order - The order object
 * @param {string} accountType - 'cash' or 'wish' account
 * @param {number} userId - User ID who processed the order
 */
async function addOrderIncome(order, accountType = 'cash', userId = null) {
  try {
    const { computeDisplayedAmounts } = require('./computeDisplayedAmounts');
    const { computedTotalUSD, computedTotalLBP } = computeDisplayedAmounts(order);
    
    // Update cashbox balances
    await updateCashboxBalances(computedTotalUSD, computedTotalLBP, accountType);
    
    // Create cashbox entry for order income
    await mcp.create('cashbox_entries', {
      entry_type: 'order_income',
      amount_usd: Number(computedTotalUSD),
      amount_lbp: Number(computedTotalLBP),
      account_type: accountType,
      description: `Order income from ${order.order_ref || order.id}`,
      notes: `Client: ${order.client_name || 'Unknown'}, Brand: ${order.brand_name || 'Unknown'}`,
      order_id: order.id,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ Added order income: ${computedTotalUSD} USD, ${computedTotalLBP} LBP to ${accountType} account`);
    
    return await getCashboxData();
  } catch (error) {
    console.error('Error adding order income to cashbox:', error);
    throw error;
  }
}

/**
 * Add delivery fee income to cashbox
 * @param {Object} order - The order object
 * @param {string} accountType - 'cash' or 'wish' account
 * @param {number} userId - User ID who processed the delivery
 */
async function addDeliveryFeeIncome(order, accountType = 'cash', userId = null) {
  try {
    const deliveryFeeUSD = Number(order.delivery_fee_usd || 0);
    const deliveryFeeLBP = Number(order.delivery_fee_lbp || 0);
    
    if (deliveryFeeUSD === 0 && deliveryFeeLBP === 0) {
      console.log('No delivery fee to add to cashbox');
      return await getCashboxData();
    }
    
    // Update cashbox balances
    await updateCashboxBalances(deliveryFeeUSD, deliveryFeeLBP, accountType);
    
    // Create cashbox entry for delivery fee
    await mcp.create('cashbox_entries', {
      entry_type: 'delivery_fee',
      amount_usd: deliveryFeeUSD,
      amount_lbp: deliveryFeeLBP,
      account_type: accountType,
      description: `Delivery fee from order ${order.order_ref || order.id}`,
      notes: `Delivery to: ${order.delivery_address || 'Unknown address'}`,
      order_id: order.id,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ Added delivery fee: ${deliveryFeeUSD} USD, ${deliveryFeeLBP} LBP to ${accountType} account`);
    
    return await getCashboxData();
  } catch (error) {
    console.error('Error adding delivery fee to cashbox:', error);
    throw error;
  }
}

/**
 * Process driver payment (expense from cashbox)
 * @param {Object} order - The order object
 * @param {string} accountType - 'cash' or 'wish' account
 * @param {number} userId - User ID who processed the payment
 */
async function processDriverPayment(order, accountType = 'cash', userId = null) {
  try {
    const driverFeeUSD = Number(order.driver_fee_usd || 0);
    const driverFeeLBP = Number(order.driver_fee_lbp || 0);
    
    if (driverFeeUSD === 0 && driverFeeLBP === 0) {
      console.log('No driver fee to deduct from cashbox');
      return await getCashboxData();
    }
    
    // Update cashbox balances (subtract for driver payment)
    await updateCashboxBalances(-driverFeeUSD, -driverFeeLBP, accountType);
    
    // Create cashbox entry for driver payment
    await mcp.create('cashbox_entries', {
      entry_type: 'expense',
      amount_usd: driverFeeUSD,
      amount_lbp: driverFeeLBP,
      account_type: accountType,
      category: 'Operations / Fleet',
      subcategory: 'Driver Salaries & Wages',
      description: `Driver payment for order ${order.order_ref || order.id}`,
      notes: `Driver: ${order.driver_name || 'Unknown'}, Order: ${order.order_ref || order.id}`,
      order_id: order.id,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ Processed driver payment: ${driverFeeUSD} USD, ${driverFeeLBP} LBP from ${accountType} account`);
    
    return await getCashboxData();
  } catch (error) {
    console.error('Error processing driver payment:', error);
    throw error;
  }
}

/**
 * Process complete order financial flow
 * This function handles the complete financial flow when an order is completed:
 * 1. Add order income to cashbox
 * 2. Add delivery fee income (if any)
 * 3. Process driver payment (if any)
 * 
 * @param {Object} order - The order object
 * @param {Object} options - Processing options
 * @param {string} options.incomeAccount - Account for income ('cash' or 'wish')
 * @param {string} options.expenseAccount - Account for expenses ('cash' or 'wish')
 * @param {number} options.userId - User ID who processed the order
 * @param {boolean} options.includeDeliveryFee - Whether to include delivery fee
 * @param {boolean} options.includeDriverPayment - Whether to process driver payment
 */
async function processOrderFinancialFlow(order, options = {}) {
  const {
    incomeAccount = 'cash',
    expenseAccount = 'cash',
    userId = null,
    includeDeliveryFee = true,
    includeDriverPayment = true
  } = options;
  
  try {
    console.log(`🔄 Processing financial flow for order ${order.order_ref || order.id}`);
    
    // 1. Add order income
    await addOrderIncome(order, incomeAccount, userId);
    
    // 2. Add delivery fee income if applicable
    if (includeDeliveryFee) {
      await addDeliveryFeeIncome(order, incomeAccount, userId);
    }
    
    // 3. Process driver payment if applicable
    if (includeDriverPayment) {
      await processDriverPayment(order, expenseAccount, userId);
    }
    
    const updatedCashbox = await getCashboxData();
    console.log(`✅ Completed financial flow for order ${order.order_ref || order.id}`);
    
    return updatedCashbox;
  } catch (error) {
    console.error(`❌ Error processing financial flow for order ${order.order_ref || order.id}:`, error);
    throw error;
  }
}

/**
 * Reverse order financial flow (for order cancellations or refunds)
 * @param {Object} order - The order object
 * @param {Object} options - Reversal options
 */
async function reverseOrderFinancialFlow(order, options = {}) {
  const {
    incomeAccount = 'cash',
    expenseAccount = 'cash',
    userId = null,
    reason = 'Order cancellation/refund'
  } = options;
  
  try {
    console.log(`🔄 Reversing financial flow for order ${order.order_ref || order.id}`);
    
    const { computeDisplayedAmounts } = require('./computeDisplayedAmounts');
    const { computedTotalUSD, computedTotalLBP } = computeDisplayedAmounts(order);
    
    // Reverse order income (subtract from cashbox)
    await updateCashboxBalances(-computedTotalUSD, -computedTotalLBP, incomeAccount);
    
    // Create reversal entry
    await mcp.create('cashbox_entries', {
      entry_type: 'cash_out',
      amount_usd: Number(computedTotalUSD),
      amount_lbp: Number(computedTotalLBP),
      account_type: incomeAccount,
      description: `Order refund/cancellation: ${order.order_ref || order.id}`,
      notes: reason,
      order_id: order.id,
      created_by: userId,
      created_at: new Date().toISOString()
    });
    
    // If driver was already paid, add it back to cashbox
    const driverFeeUSD = Number(order.driver_fee_usd || 0);
    const driverFeeLBP = Number(order.driver_fee_lbp || 0);
    
    if (driverFeeUSD > 0 || driverFeeLBP > 0) {
      await updateCashboxBalances(driverFeeUSD, driverFeeLBP, expenseAccount);
      
      await mcp.create('cashbox_entries', {
        entry_type: 'cash_in',
        amount_usd: driverFeeUSD,
        amount_lbp: driverFeeLBP,
        account_type: expenseAccount,
        description: `Driver payment reversal: ${order.order_ref || order.id}`,
        notes: `Reversed due to: ${reason}`,
        order_id: order.id,
        created_by: userId,
        created_at: new Date().toISOString()
      });
    }
    
    const updatedCashbox = await getCashboxData();
    console.log(`✅ Reversed financial flow for order ${order.order_ref || order.id}`);
    
    return updatedCashbox;
  } catch (error) {
    console.error(`❌ Error reversing financial flow for order ${order.order_ref || order.id}:`, error);
    throw error;
  }
}

module.exports = {
  getCashboxData,
  updateCashboxBalances,
  addOrderIncome,
  addDeliveryFeeIncome,
  processDriverPayment,
  processOrderFinancialFlow,
  reverseOrderFinancialFlow
};
