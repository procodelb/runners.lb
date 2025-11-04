/**
 * Example of how to integrate orders with the cashbox system
 * This shows how to automatically add order income and process driver payments
 */

const { processOrderFinancialFlow, reverseOrderFinancialFlow } = require('../utils/cashboxIntegration');

/**
 * Example: Process order completion with cashbox integration
 */
async function handleOrderCompletion(orderId, userId) {
  try {
    // Get order details (this would come from your order processing logic)
    const order = {
      id: orderId,
      order_ref: 'ORD-2024-001',
      client_name: 'John Doe',
      brand_name: 'Nike',
      total_amount_usd: 150,
      total_amount_lbp: 225000,
      delivery_fee_usd: 5,
      delivery_fee_lbp: 7500,
      driver_fee_usd: 10,
      driver_fee_lbp: 15000,
      driver_name: 'Ahmed Ali',
      delivery_address: 'Beirut, Lebanon',
      status: 'completed',
      payment_status: 'paid'
    };
    
    // Process the complete financial flow
    const updatedCashbox = await processOrderFinancialFlow(order, {
      incomeAccount: 'cash',        // Add income to cash account
      expenseAccount: 'cash',       // Pay driver from cash account
      userId: userId,
      includeDeliveryFee: true,     // Include delivery fee as income
      includeDriverPayment: true    // Process driver payment as expense
    });
    
    console.log('✅ Order financial flow processed successfully');
    console.log('Updated cashbox balances:', {
      total_usd: updatedCashbox.balance_usd,
      total_lbp: updatedCashbox.balance_lbp,
      cash_usd: updatedCashbox.cash_balance_usd,
      cash_lbp: updatedCashbox.cash_balance_lbp
    });
    
    return updatedCashbox;
  } catch (error) {
    console.error('❌ Error processing order completion:', error);
    throw error;
  }
}

/**
 * Example: Handle order cancellation/refund
 */
async function handleOrderCancellation(orderId, userId, reason = 'Customer cancellation') {
  try {
    // Get order details
    const order = {
      id: orderId,
      order_ref: 'ORD-2024-001',
      client_name: 'John Doe',
      brand_name: 'Nike',
      total_amount_usd: 150,
      total_amount_lbp: 225000,
      delivery_fee_usd: 5,
      delivery_fee_lbp: 7500,
      driver_fee_usd: 10,
      driver_fee_lbp: 15000,
      driver_name: 'Ahmed Ali'
    };
    
    // Reverse the financial flow
    const updatedCashbox = await reverseOrderFinancialFlow(order, {
      incomeAccount: 'cash',
      expenseAccount: 'cash',
      userId: userId,
      reason: reason
    });
    
    console.log('✅ Order financial flow reversed successfully');
    console.log('Updated cashbox balances:', {
      total_usd: updatedCashbox.balance_usd,
      total_lbp: updatedCashbox.balance_lbp,
      cash_usd: updatedCashbox.cash_balance_usd,
      cash_lbp: updatedCashbox.cash_balance_lbp
    });
    
    return updatedCashbox;
  } catch (error) {
    console.error('❌ Error processing order cancellation:', error);
    throw error;
  }
}

/**
 * Example: Process multiple orders in batch
 */
async function processBatchOrders(orders, userId) {
  try {
    console.log(`🔄 Processing ${orders.length} orders...`);
    
    const results = [];
    for (const order of orders) {
      try {
        const result = await processOrderFinancialFlow(order, {
          incomeAccount: 'cash',
          expenseAccount: 'cash',
          userId: userId,
          includeDeliveryFee: true,
          includeDriverPayment: true
        });
        results.push({ orderId: order.id, success: true, result });
        console.log(`✅ Processed order ${order.order_ref || order.id}`);
      } catch (error) {
        results.push({ orderId: order.id, success: false, error: error.message });
        console.error(`❌ Failed to process order ${order.order_ref || order.id}:`, error.message);
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Batch processing completed: ${successful} successful, ${failed} failed`);
    
    return results;
  } catch (error) {
    console.error('❌ Error in batch processing:', error);
    throw error;
  }
}

/**
 * Example: Integration with existing order routes
 * This shows how you would modify your existing order completion endpoint
 */
function integrateWithOrderRoutes() {
  // This is an example of how to modify your existing order routes
  // You would add this to your actual order completion logic
  
  const exampleOrderCompletionHandler = async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      
      // Your existing order completion logic here...
      // const order = await completeOrder(orderId);
      
      // Add cashbox integration
      // await processOrderFinancialFlow(order, {
      //   incomeAccount: 'cash',
      //   expenseAccount: 'cash',
      //   userId: userId,
      //   includeDeliveryFee: true,
      //   includeDriverPayment: true
      // });
      
      // res.json({ success: true, message: 'Order completed and financial flow processed' });
    } catch (error) {
      console.error('Error completing order:', error);
      // res.status(500).json({ success: false, message: 'Failed to complete order' });
    }
  };
  
  return exampleOrderCompletionHandler;
}

module.exports = {
  handleOrderCompletion,
  handleOrderCancellation,
  processBatchOrders,
  integrateWithOrderRoutes
};

// Example usage
if (require.main === module) {
  // Test the integration
  handleOrderCompletion(1, 1)
    .then(() => console.log('✅ Integration test completed'))
    .catch(error => console.error('❌ Integration test failed:', error));
}
