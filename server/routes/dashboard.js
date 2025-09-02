const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Get total orders
    const totalOrdersQuery = 'SELECT COUNT(*) as total_orders FROM orders';
    const totalOrdersResult = await query(totalOrdersQuery);
    const totalOrders = totalOrdersResult[0]?.total_orders || 0;

    // Get pending orders
    const pendingOrdersQuery = "SELECT COUNT(*) as pending_orders FROM orders WHERE status IN ('new','pending')";
    const pendingOrdersResult = await query(pendingOrdersQuery);
    const pendingOrders = pendingOrdersResult[0]?.pending_orders || 0;

    // Get completed orders
    const completedOrdersQuery = "SELECT COUNT(*) as completed_orders FROM orders WHERE status = 'completed'";
    const completedOrdersResult = await query(completedOrdersQuery);
    const completedOrders = completedOrdersResult[0]?.completed_orders || 0;

    // Get total clients
    const totalClientsQuery = 'SELECT COUNT(*) as total_clients FROM clients';
    const totalClientsResult = await query(totalClientsQuery);
    const totalClients = totalClientsResult[0]?.total_clients || 0;

    // Get active drivers
    const activeDriversQuery = 'SELECT COUNT(*) as active_drivers FROM drivers WHERE active = true';
    const activeDriversResult = await query(activeDriversQuery);
    const activeDrivers = activeDriversResult[0]?.active_drivers || 0;

    // Get total revenue from delivery fees (company revenue)
    const totalRevenueQuery = `
      SELECT 
        COALESCE(SUM(delivery_fee_usd), 0) as total_revenue_usd,
        COALESCE(SUM(delivery_fee_lbp), 0) as total_revenue_lbp
      FROM orders 
      WHERE status = 'completed' AND payment_status = 'paid'
    `;
    const totalRevenueResult = await query(totalRevenueQuery);
    const totalRevenue = {
      usd: parseFloat(totalRevenueResult[0]?.total_revenue_usd) || 0,
      lbp: parseInt(totalRevenueResult[0]?.total_revenue_lbp) || 0
    };

    // Get pending payments
    const pendingPaymentsQuery = `
      SELECT 
        COALESCE(SUM(total_usd), 0) as pending_usd,
        COALESCE(SUM(total_lbp), 0) as pending_lbp
      FROM orders 
      WHERE payment_status = 'unpaid'
    `;
    const pendingPaymentsResult = await query(pendingPaymentsQuery);
    const pendingPayments = {
      usd: parseFloat(pendingPaymentsResult[0]?.pending_usd) || 0,
      lbp: parseInt(pendingPaymentsResult[0]?.pending_lbp) || 0
    };

    // Orders by status
    const ordersByStatus = await query(`
      SELECT status, COUNT(*)::int as count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);

    // Revenue by month using delivery fees
    const revenueByMonth = await query(`
      SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') as month,
             COALESCE(SUM(delivery_fee_usd),0) as revenue_usd,
             COALESCE(SUM(delivery_fee_lbp),0) as revenue_lbp
      FROM orders
      WHERE status='completed' AND payment_status='paid'
      GROUP BY 1
      ORDER BY month DESC
      LIMIT 12
    `);

    // Top clients by delivery fees
    const topClients = await query(`
      SELECT c.id as client_id, c.business_name,
             COALESCE(SUM(o.delivery_fee_usd),0) as total_usd,
             COALESCE(SUM(o.delivery_fee_lbp),0) as total_lbp,
             COUNT(o.id)::int as orders_count
      FROM clients c
      JOIN orders o ON o.brand_name = c.business_name
      WHERE o.status='completed' AND o.payment_status='paid'
      GROUP BY c.id, c.business_name
      ORDER BY total_usd DESC, total_lbp DESC
      LIMIT 10
    `);

    // Driver performance
    const driverPerformance = await query(`
      SELECT d.id as driver_id, d.full_name,
             COUNT(o.id)::int as deliveries_count,
             COALESCE(SUM(o.driver_fee_usd),0) as earnings_usd,
             COALESCE(SUM(o.driver_fee_lbp),0) as earnings_lbp
      FROM drivers d
      LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('delivered','completed')
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      ORDER BY deliveries_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalClients,
        activeDrivers,
        totalRevenue,
        pendingPayments,
        ordersByStatus,
        revenueByMonth,
        topClients,
        driverPerformance,
        totals: {
          total_orders: totalOrders,
          total_clients: totalClients,
          total_drivers: activeDrivers,
          total_revenue_usd: totalRevenue.usd,
          total_revenue_lbp: totalRevenue.lbp,
          total_expense_usd: 0,
          total_expense_lbp: 0,
          net_usd: totalRevenue.usd,
          net_lbp: totalRevenue.lbp
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard stats',
      error: error.message 
    });
  }
});

// Get recent activity
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get recent orders
    const recentOrdersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      ORDER BY o.created_at DESC
      LIMIT ?
    `;
    
    const ordersResult = await query(recentOrdersQuery, [limit]);

    // Get recent transactions
    const recentTransactionsQuery = `
      SELECT 
        t.*,
        u.full_name as created_by_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    
    const transactionsResult = await query(recentTransactionsQuery, [limit]);

    res.json({
      success: true,
      data: {
        recentOrders: ordersResult,
        recentTransactions: transactionsResult
      }
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent activity',
      error: error.message 
    });
  }
});

// Get analytics data
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Get monthly revenue trends
    const revenueTrendsQuery = `
      SELECT 
        to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
        SUM(total_usd) as revenue_usd,
        SUM(total_lbp) as revenue_lbp,
        COUNT(*) as order_count
      FROM orders 
      WHERE status = 'completed' AND payment_status = 'paid'
      GROUP BY 1
      ORDER BY month DESC
      LIMIT 12
    `;
    
    const revenueTrends = await query(revenueTrendsQuery);

    // Get top clients by sales
    const topClientsQuery = `
      SELECT 
        c.business_name,
        COUNT(o.id) as order_count,
        SUM(o.total_usd) as total_sales_usd,
        SUM(o.total_lbp) as total_sales_lbp
      FROM clients c
      LEFT JOIN orders o ON c.business_name = o.brand_name
      WHERE o.status = 'completed' AND o.payment_status = 'paid'
      GROUP BY c.id, c.business_name
      ORDER BY total_sales_usd DESC
      LIMIT 5
    `;
    
    const topClients = await query(topClientsQuery);

    // Get driver performance stats
    const driverPerformanceQuery = `
      SELECT 
        d.full_name,
        COUNT(o.id) as completed_orders,
        SUM(o.driver_fee_usd) as total_fees_usd,
        SUM(o.driver_fee_lbp) as total_fees_lbp,
        AVG(o.driver_fee_usd) as avg_fee_usd
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id 
        AND o.status = 'completed'
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      ORDER BY completed_orders DESC
      LIMIT 10
    `;
    
    const driverPerformance = await query(driverPerformanceQuery);

    // Get orders by status distribution
    const ordersByStatusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      GROUP BY status
    `;
    
    const ordersByStatus = await query(ordersByStatusQuery);

    res.json({
      success: true,
      data: {
        revenueTrends,
        topClients,
        driverPerformance,
        ordersByStatus
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics data',
      error: error.message 
    });
  }
});

// Get financial summary
router.get('/financial-summary', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    let dateFilter = '';
    let filterParams = [];
    
    if (from_date && to_date) {
      dateFilter = 'WHERE created_at BETWEEN ? AND ?';
      filterParams = [from_date, to_date];
    } else if (from_date) {
      dateFilter = 'WHERE created_at >= ?';
      filterParams = [from_date];
    } else if (to_date) {
      dateFilter = 'WHERE created_at <= ?';
      filterParams = [to_date];
    }

    // Get total revenue
    let revenueQuery;
    if (dateFilter) {
      revenueQuery = `
        SELECT 
          COALESCE(SUM(total_usd), 0) as total_revenue_usd,
          COALESCE(SUM(total_lbp), 0) as total_revenue_lbp,
          COUNT(*) as total_orders
        FROM orders
        ${dateFilter} AND status = 'completed' AND payment_status = 'paid'
      `;
    } else {
      revenueQuery = `
        SELECT 
          COALESCE(SUM(total_usd), 0) as total_revenue_usd,
          COALESCE(SUM(total_lbp), 0) as total_revenue_lbp,
          COUNT(*) as total_orders
        FROM orders
        WHERE status = 'completed' AND payment_status = 'paid'
      `;
    }
    
    const revenueResult = await query(revenueQuery, filterParams);

    // Get pending payments
    let pendingQuery;
    if (dateFilter) {
      pendingQuery = `
        SELECT 
          COALESCE(SUM(total_usd), 0) as pending_usd,
          COALESCE(SUM(total_lbp), 0) as pending_lbp,
          COUNT(*) as pending_orders
        FROM orders
        ${dateFilter} AND payment_status = 'unpaid'
      `;
    } else {
      pendingQuery = `
        SELECT 
          COALESCE(SUM(total_usd), 0) as pending_usd,
          COALESCE(SUM(total_lbp), 0) as pending_lbp,
          COUNT(*) as pending_orders
        FROM orders
        WHERE payment_status = 'unpaid'
      `;
    }
    
    const pendingResult = await query(pendingQuery, filterParams);

    // Get driver costs
    let driverCostsQuery;
    if (dateFilter) {
      driverCostsQuery = `
        SELECT 
          COALESCE(SUM(driver_fee_usd), 0) as total_driver_costs_usd,
          COALESCE(SUM(driver_fee_lbp), 0) as total_driver_costs_lbp
        FROM orders
        ${dateFilter} AND status = 'completed'
      `;
    } else {
      driverCostsQuery = `
        SELECT 
          COALESCE(SUM(driver_fee_usd), 0) as total_driver_costs_usd,
          COALESCE(SUM(driver_fee_lbp), 0) as total_driver_costs_lbp
        FROM orders
        WHERE status = 'completed'
      `;
    }
    
    const driverCostsResult = await query(driverCostsQuery, filterParams);

    const financialSummary = {
      revenue: {
        usd: parseFloat(revenueResult[0]?.total_revenue_usd) || 0,
        lbp: parseInt(revenueResult[0]?.total_revenue_lbp) || 0,
        orders: parseInt(revenueResult[0]?.total_orders) || 0
      },
      pending: {
        usd: parseFloat(pendingResult[0]?.pending_usd) || 0,
        lbp: parseInt(pendingResult[0]?.pending_lbp) || 0,
        orders: parseInt(pendingResult[0]?.pending_orders) || 0
      },
      driverCosts: {
        usd: parseFloat(driverCostsResult[0]?.total_driver_costs_usd) || 0,
        lbp: parseInt(driverCostsResult[0]?.total_driver_costs_lbp) || 0
      },
      netProfit: {
        usd: parseFloat(revenueResult[0]?.total_revenue_usd) - parseFloat(driverCostsResult[0]?.total_driver_costs_usd) || 0,
        lbp: parseInt(revenueResult[0]?.total_revenue_lbp) - parseInt(driverCostsResult[0]?.total_driver_costs_lbp) || 0
      }
    };

    res.json({
      success: true,
      data: financialSummary
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch financial summary',
      error: error.message 
    });
  }
});

module.exports = router;
