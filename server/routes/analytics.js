const express = require('express');
const { query } = require('../config/database');
const mcp = require('../mcp');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Root analytics endpoint - provides overview
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get basic analytics overview
    const overviewQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status IN ('new', 'assigned', 'picked_up', 'in_transit') THEN 1 END) as active_orders,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_usd ELSE 0 END), 0) as total_revenue_usd,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_lbp ELSE 0 END), 0) as total_revenue_lbp
      FROM orders
    `;
    
    const overview = await query(overviewQuery);
    
    res.json({
      success: true,
      message: 'Analytics overview - use /dashboard for detailed analytics',
      data: {
        overview: overview[0],
        available_endpoints: [
          '/analytics/dashboard - Comprehensive dashboard analytics',
          '/analytics/operational - Operational metrics and efficiency',
          '/analytics/revenue - Revenue and financial analytics'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics overview',
      error: error.message 
    });
  }
});

// Get comprehensive analytics dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', from_date, to_date } = req.query;
    
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

    // Get overall statistics
    const overallStatsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'pending' OR status = 'new' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_usd ELSE 0 END), 0) as total_revenue_usd,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_lbp ELSE 0 END), 0) as total_revenue_lbp
      FROM orders
      ${dateFilter}
    `;
    
    const overallStats = await query(overallStatsQuery, filterParams);

    // Get monthly trends - PostgreSQL compatible
    const monthlyTrendsQuery = `
      SELECT 
        to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_usd ELSE 0 END), 0) as revenue_usd,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_lbp ELSE 0 END), 0) as revenue_lbp
      FROM orders
      ${dateFilter}
      GROUP BY date_trunc('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `;
    
    const monthlyTrends = await query(monthlyTrendsQuery, filterParams);

    // Get top performing clients
    const topClientsQuery = `
      SELECT 
        c.business_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_usd), 0) as total_sales_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_sales_lbp,
        AVG(o.total_usd) as avg_order_usd
      FROM clients c
      LEFT JOIN orders o ON c.business_name = o.brand_name
      ${dateFilter ? dateFilter.replace('created_at', 'o.created_at').replace('WHERE', 'AND') : ''}
      WHERE o.status = 'completed'
      GROUP BY c.id, c.business_name
      ORDER BY total_sales_usd DESC
      LIMIT 10
    `;
    
    const topClients = await query(topClientsQuery, filterParams);

    // Get driver performance
    const driverPerformanceQuery = `
      SELECT 
        d.full_name,
        d.phone,
        COUNT(o.id) as completed_orders,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_fees_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_fees_lbp,
        AVG(o.driver_fee_usd) as avg_fee_usd,
        COALESCE(SUM(o.total_usd), 0) as total_delivered_value_usd
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id 
        AND o.status = 'completed'
        ${dateFilter ? 'AND ' + dateFilter.replace('created_at', 'o.created_at') : ''}
      WHERE d.active = true
      GROUP BY d.id, d.full_name, d.phone
      ORDER BY completed_orders DESC
      LIMIT 15
    `;
    
    const driverPerformance = await query(driverPerformanceQuery, filterParams);

    // Get orders by status distribution
    const ordersByStatusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_usd), 0) as total_value_usd
      FROM orders
      ${dateFilter || ''}
      GROUP BY status
      ORDER BY count DESC
    `;
    
    const ordersByStatus = await query(ordersByStatusQuery, filterParams);

    // Get orders by type distribution
    const ordersByTypeQuery = `
      SELECT 
        type,
        COUNT(*) as count,
        COALESCE(SUM(total_usd), 0) as total_value_usd
      FROM orders
      ${dateFilter || ''}
      GROUP BY type
      ORDER BY count DESC
    `;
    
    const ordersByType = await query(ordersByTypeQuery, filterParams);

    // Get payment status distribution
    const paymentStatusQuery = `
      SELECT 
        payment_status,
        COUNT(*) as count,
        COALESCE(SUM(total_usd), 0) as total_value_usd
      FROM orders
      ${dateFilter || ''}
      GROUP BY payment_status
      ORDER BY count DESC
    `;
    
    const paymentStatus = await query(paymentStatusQuery, filterParams);

    const analyticsData = {
      overall: {
        totalOrders: parseInt(overallStats[0]?.total_orders) || 0,
        completedOrders: parseInt(overallStats[0]?.completed_orders) || 0,
        pendingOrders: parseInt(overallStats[0]?.pending_orders) || 0,
        paidOrders: parseInt(overallStats[0]?.paid_orders) || 0,
        unpaidOrders: parseInt(overallStats[0]?.unpaid_orders) || 0,
        totalRevenue: {
          usd: parseFloat(overallStats[0]?.total_revenue_usd) || 0,
          lbp: parseInt(overallStats[0]?.total_revenue_lbp) || 0
        }
      },
      trends: monthlyTrends,
      topClients,
      driverPerformance,
      distributions: {
        byStatus: ordersByStatus,
        byType: ordersByType,
        byPaymentStatus: paymentStatus
      }
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics dashboard',
      error: error.message 
    });
  }
});

// Get revenue analytics
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', from_date, to_date } = req.query;
    
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

    // Get revenue by period - PostgreSQL compatible
    const revenueByPeriodQuery = `
      SELECT 
        to_char(date_trunc('month', created_at), 'YYYY-MM') as period,
        COUNT(*) as order_count,
        COALESCE(SUM(total_usd), 0) as revenue_usd,
        COALESCE(SUM(total_lbp), 0) as revenue_lbp,
        COALESCE(SUM(delivery_fee_usd), 0) as delivery_fees_usd,
        COALESCE(SUM(delivery_fee_lbp), 0) as delivery_fees_lbp
      FROM orders
      ${dateFilter ? dateFilter + ' AND ' : 'WHERE '}status = 'completed' AND payment_status = 'paid'
      GROUP BY date_trunc('month', created_at)
      ORDER BY period DESC
      LIMIT 24
    `;
    
    const revenueByPeriod = await query(revenueByPeriodQuery, filterParams);

    // Get revenue by client
    const revenueByClientQuery = `
      SELECT 
        c.business_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        AVG(o.total_usd) as avg_order_usd
      FROM clients c
      LEFT JOIN orders o ON c.business_name = o.brand_name
      ${dateFilter ? 'AND ' + dateFilter.replace('created_at', 'o.created_at') : ''}
      WHERE o.status = 'completed' AND o.payment_status = 'paid'
      GROUP BY c.id, c.business_name
      ORDER BY total_revenue_usd DESC
      LIMIT 20
    `;
    
    const revenueByClient = await query(revenueByClientQuery, filterParams);

    // Get revenue by order type
    const revenueByTypeQuery = `
      SELECT 
        type,
        COUNT(*) as order_count,
        COALESCE(SUM(total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(total_lbp), 0) as total_revenue_lbp,
        AVG(total_usd) as avg_order_usd
      FROM orders
      ${dateFilter ? dateFilter + ' AND ' : 'WHERE '}status = 'completed' AND payment_status = 'paid'
      GROUP BY type
      ORDER BY total_revenue_usd DESC
    `;
    
    const revenueByType = await query(revenueByTypeQuery, filterParams);

    const revenueAnalytics = {
      byPeriod: revenueByPeriod,
      byClient: revenueByClient,
      byType: revenueByType
    };

    res.json({
      success: true,
      data: revenueAnalytics
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch revenue analytics',
      error: error.message 
    });
  }
});

// Get operational analytics
router.get('/operational', authenticateToken, async (req, res) => {
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

    // Get order processing times - PostgreSQL compatible
    const processingTimesQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 as avg_processing_days,
        MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 as min_processing_days,
        MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 as max_processing_days
      FROM orders
      ${dateFilter ? dateFilter + ' AND ' : 'WHERE '}status = 'completed'
      AND updated_at IS NOT NULL
    `;
    
    const processingTimes = await query(processingTimesQuery, filterParams);

    // Get driver efficiency
    const driverEfficiencyQuery = `
      SELECT 
        d.full_name,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        ROUND(COUNT(CASE WHEN o.status = 'completed' THEN 1 END) * 100.0 / COUNT(o.id), 2) as completion_rate,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_earnings_usd
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id
      ${dateFilter ? 'AND ' + dateFilter.replace('created_at', 'o.created_at') : ''}
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      HAVING COUNT(o.id) > 0
      ORDER BY completion_rate DESC
      LIMIT 15
    `;
    
    const driverEfficiency = await query(driverEfficiencyQuery, filterParams);

    // Get order status transitions
    const statusTransitionsQuery = `
      SELECT 
        status,
        payment_status,
        COUNT(*) as count
      FROM orders
      ${dateFilter || ''}
      GROUP BY status, payment_status
      ORDER BY count DESC
    `;
    
    const statusTransitions = await query(statusTransitionsQuery, filterParams);

    const operationalAnalytics = {
      processingTimes: {
        average: parseFloat(processingTimes[0]?.avg_processing_days) || 0,
        minimum: parseFloat(processingTimes[0]?.min_processing_days) || 0,
        maximum: parseFloat(processingTimes[0]?.max_processing_days) || 0
      },
      driverEfficiency,
      statusTransitions
    };

    res.json({
      success: true,
      data: operationalAnalytics
    });
  } catch (error) {
    console.error('Error fetching operational analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch operational analytics',
      error: error.message 
    });
  }
});

module.exports = router;
