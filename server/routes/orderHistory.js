const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get completed orders (order history)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      from_date = '', 
      to_date = '', 
      brand_name = '',
      driver_id = '',
      status = '',
      sortBy = 'completed_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build filter conditions for completed orders (status completed, delivered, or cancelled)
    let filterConditions = [];
    let filterParams = [];

    // Base condition for completed orders
    filterConditions.push('(o.status IN (?, ?, ?) OR (o.status = ? AND o.payment_status = ?))');
    filterParams.push('completed', 'delivered', 'cancelled', 'delivered', 'paid');

    if (from_date) {
      filterConditions.push(`(o.completed_at >= ? OR o.created_at >= ?)`);
      filterParams.push(from_date, from_date);
    }

    if (to_date) {
      filterConditions.push(`(o.completed_at <= ? OR o.created_at <= ?)`);
      filterParams.push(to_date, to_date);
    }

    if (brand_name) {
      filterConditions.push(`o.brand_name LIKE ?`);
      filterParams.push(`%${brand_name}%`);
    }

    if (driver_id) {
      filterConditions.push(`o.driver_id = ?`);
      filterParams.push(driver_id);
    }

    if (status) {
      filterConditions.push(`o.status = ?`);
      filterParams.push(status);
    }

    const whereClause = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM orders o ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const totalCount = parseInt(countResult[0]?.count || 0);

    // Get completed orders with pagination
    const ordersQuery = `
      SELECT 
        o.*,
        d.full_name as driver_name,
        d.phone as driver_phone,
        u.full_name as created_by_name,
        c.business_name as client_name,
        c.contact_person as client_contact,
        CASE 
          WHEN o.third_party_name IS NOT NULL AND o.third_party_name <> '' THEN 'third_party'
          WHEN o.driver_id IS NOT NULL THEN 'driver'
          ELSE 'client'
        END as account_type
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN clients c ON o.brand_name = c.business_name
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    filterParams.push(limit, offset);
    const ordersResult = await query(ordersQuery, filterParams);

    // Group by account_type for UI tabs
    const grouped = { client: [], driver: [], third_party: [] };
    for (const row of ordersResult) {
      const key = row.account_type || 'client';
      if (grouped[key]) grouped[key].push(row);
    }

    res.json({
      success: true,
      data: grouped,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      data: [] // Always return empty array on error
    });
  }
});

// Get order history statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { from_date = '', to_date = '' } = req.query;
    
    let dateFilter = '';
    let filterParams = [];
    
    if (from_date && to_date) {
      dateFilter = 'WHERE o.completed_at BETWEEN ? AND ?';
      filterParams = [from_date, to_date];
    } else if (from_date) {
      dateFilter = 'WHERE o.completed_at >= ?';
      filterParams = [from_date];
    } else if (to_date) {
      dateFilter = 'WHERE o.completed_at <= ?';
      filterParams = [to_date];
    }

    // Get total completed orders
    const totalCompletedResult = await query(`
      SELECT COUNT(*) as total_completed
      FROM orders o
      ${dateFilter}
      WHERE o.status = 'completed' AND o.payment_status = 'paid'
    `, filterParams);

    // Get total revenue from completed orders
    const totalRevenueResult = await query(`
      SELECT 
        COALESCE(SUM(o.total_usd), 0) as total_revenue_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_revenue_lbp,
        COALESCE(SUM(o.delivery_fee_usd), 0) as total_delivery_fees_usd,
        COALESCE(SUM(o.delivery_fee_lbp), 0) as total_delivery_fees_lbp
      FROM orders o
      ${dateFilter}
      WHERE o.status = 'completed' AND o.payment_status = 'paid'
    `, filterParams);

    // Get orders by type
    const ordersByTypeResult = await query(`
      SELECT 
        o.type,
        COUNT(*) as count,
        COALESCE(SUM(o.total_usd), 0) as total_usd,
        COALESCE(SUM(o.total_lbp), 0) as total_lbp
      FROM orders o
      ${dateFilter}
      WHERE o.status = 'completed' AND o.payment_status = 'paid'
      GROUP BY o.type
      ORDER BY count DESC
    `, filterParams);

    // Get top performing drivers
    const topDriversResult = await query(`
      SELECT 
        d.full_name,
        COUNT(o.id) as completed_orders,
        COALESCE(SUM(o.driver_fee_usd), 0) as total_fees_usd,
        COALESCE(SUM(o.driver_fee_lbp), 0) as total_fees_lbp
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id 
        AND o.status IN ('delivered', 'completed')
        ${dateFilter ? 'AND ' + dateFilter.replace('o.completed_at', 'o.completed_at') : ''}
      WHERE d.active = true
      GROUP BY d.id, d.full_name
      HAVING COUNT(o.id) > 0
      ORDER BY completed_orders DESC
      LIMIT 5
    `, filterParams);

    const stats = {
      totalCompleted: parseInt(totalCompletedResult[0].total_completed),
      totalRevenue: {
        usd: parseFloat(totalRevenueResult[0].total_revenue_usd) || 0,
        lbp: parseInt(totalRevenueResult[0].total_revenue_lbp) || 0
      },
      totalDeliveryFees: {
        usd: parseFloat(totalRevenueResult[0].total_delivery_fees_usd) || 0,
        lbp: parseInt(totalRevenueResult[0].total_delivery_fees_lbp) || 0
      },
             ordersByType: ordersByTypeResult,
       topDrivers: topDriversResult
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get order history stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Export order history to CSV/PDF
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'csv', from_date = '', to_date = '' } = req.query;
    
    let dateFilter = '';
    let filterParams = [];
    
    if (from_date && to_date) {
      dateFilter = 'WHERE o.completed_at BETWEEN ? AND ?';
      filterParams = [from_date, to_date];
    } else if (from_date) {
      dateFilter = 'WHERE o.completed_at >= ?';
      filterParams = [from_date];
    } else if (to_date) {
      dateFilter = 'WHERE o.completed_at <= ?';
      filterParams = [to_date];
    }

    // Get all completed orders for export
    const ordersQuery = `
      SELECT 
        o.order_ref,
        o.type,
        o.brand_name,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.total_usd,
        o.total_lbp,
        o.delivery_fee_usd,
        o.delivery_fee_lbp,
        o.driver_fee_usd,
        o.driver_fee_lbp,
        o.status,
        o.payment_status,
        o.completed_at,
        d.full_name as driver_name,
        c.business_name as client_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.brand_name = c.business_name
      ${dateFilter}
      AND o.status = 'completed' AND o.payment_status = 'paid'
      ORDER BY o.completed_at DESC
    `;
    
    const ordersResult = await query(ordersQuery, filterParams);

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Order Ref', 'Type', 'Brand Name', 'Customer Name', 'Customer Phone',
        'Customer Address', 'Total USD', 'Total LBP', 'Delivery Fee USD',
        'Delivery Fee LBP', 'Driver Fee USD', 'Driver Fee LBP', 'Status',
        'Payment Status', 'Completed At', 'Driver Name', 'Client Name'
      ];

             const csvData = ordersResult.map(order => [
        order.order_ref,
        order.type,
        order.brand_name || '',
        order.customer_name || '',
        order.customer_phone || '',
        order.customer_address || '',
        order.total_usd || 0,
        order.total_lbp || 0,
        order.delivery_fee_usd || 0,
        order.delivery_fee_lbp || 0,
        order.driver_fee_usd || 0,
        order.driver_fee_lbp || 0,
        order.status,
        order.payment_status,
        order.completed_at,
        order.driver_name || '',
        order.client_name || ''
      ]);

      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="order_history_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } else {
      // Return JSON for other formats
      res.json({
        success: true,
        data: ordersResult,
        exportInfo: {
          format,
          from_date,
          to_date,
          total_records: ordersResult.length,
          exported_at: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Export order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
