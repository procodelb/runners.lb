const { query, run } = require('../config/database');
const { computeDisplayedAmounts } = require('../utils/computeDisplayedAmounts');

function ok(res, data, message = 'OK') {
  return res.json({ success: true, message, data });
}

function fail(res, status, message, error) {
  return res.status(status).json({ success: false, message, error });
}

async function getEntities(req, res) {
  try {
    const { search = '' } = req.query;
    const like = `%${search}%`;

    const clients = await query(`
      SELECT c.id, c.business_name as name, c.phone, c.address,
             COUNT(o.id)::int as total_orders,
             COALESCE(SUM(CASE WHEN o.moved_to_history = false OR o.moved_to_history IS NULL THEN 1 ELSE 0 END),0)::int AS uncashed_orders,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_usd ELSE 0 END),0) AS uncashed_total_usd,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_lbp ELSE 0 END),0) AS uncashed_total_lbp
      FROM clients c
      LEFT JOIN orders o ON o.customer_name = c.business_name OR o.customer_name = c.id::text
      ${search ? 'WHERE LOWER(c.business_name) LIKE LOWER($1) OR LOWER(c.contact_person) LIKE LOWER($1)' : ''}
      GROUP BY c.id, c.business_name, c.phone, c.address
      ORDER BY uncashed_total_usd DESC
      ${search ? '' : ''}
    `, search ? [like] : []);

    const drivers = await query(`
      SELECT d.id, d.full_name as name, d.phone, d.address,
             COUNT(o.id)::int as total_orders,
             COALESCE(SUM(CASE WHEN o.moved_to_history = false OR o.moved_to_history IS NULL THEN 1 ELSE 0 END),0)::int AS uncashed_orders,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_usd ELSE 0 END),0) AS uncashed_total_usd,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_lbp ELSE 0 END),0) AS uncashed_total_lbp
      FROM drivers d
      LEFT JOIN orders o ON o.driver_id = d.id
      ${search ? 'WHERE LOWER(d.full_name) LIKE LOWER($1) OR LOWER(d.phone) LIKE LOWER($1)' : ''}
      GROUP BY d.id, d.full_name, d.phone, d.address
      ORDER BY uncashed_total_usd DESC
    `, search ? [like] : []);

    const thirdParties = await query(`
      SELECT o.third_party_name as name,
             COUNT(o.id)::int as total_orders,
             COALESCE(SUM(CASE WHEN o.moved_to_history = false OR o.moved_to_history IS NULL THEN 1 ELSE 0 END),0)::int AS uncashed_orders,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_usd ELSE 0 END),0) AS uncashed_total_usd,
             COALESCE(SUM(CASE WHEN (o.moved_to_history = false OR o.moved_to_history IS NULL) THEN o.computed_total_lbp ELSE 0 END),0) AS uncashed_total_lbp
      FROM orders o
      WHERE o.third_party_name IS NOT NULL AND TRIM(o.third_party_name) != ''
        ${search ? 'AND LOWER(o.third_party_name) LIKE LOWER($1)' : ''}
      GROUP BY o.third_party_name
      ORDER BY uncashed_total_usd DESC
    `, search ? [like] : []);

    return ok(res, { clients, drivers, third_parties: thirdParties }, 'Entities fetched');
  } catch (err) {
    console.error('getEntities error:', err);
    return fail(res, 500, 'Failed to fetch entities', err.message);
  }
}

async function getEntityOrders(req, res) {
  try {
    const { type, id } = req.params; // type: clients|drivers|third_party
    const { uncashedOnly = 'true' } = req.query;
    const wantUncashed = String(uncashedOnly).toLowerCase() !== 'false';

    let where = [];
    let params = [];
    if (type === 'clients') {
      where.push('(o.customer_name = $1 OR o.customer_name = $2)');
      params.push(id, id);
    } else if (type === 'drivers') {
      where.push('o.driver_id = $1');
      params.push(id);
    } else if (type === 'third_party') {
      where.push('o.third_party_name = $1');
      params.push(id);
    } else {
      return fail(res, 400, 'Invalid type');
    }
    if (wantUncashed) {
      where.push('(o.moved_to_history = false OR o.moved_to_history IS NULL)');
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(`
      SELECT o.*,
             d.full_name as driver_name,
             u.full_name as created_by_name
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.created_by = u.id
      ${whereSql}
      ORDER BY (o.moved_to_history = true) ASC, o.created_at DESC
    `, params);

    const withComputed = rows.map(r => {
      const c = computeDisplayedAmounts(r);
      return {
        ...r,
        computed_total_usd: c.computedTotalUSD,
        computed_total_lbp: c.computedTotalLBP,
        deliveryFeesUSDShown: c.deliveryFeesUSDShown,
        deliveryFeesLBPShown: c.deliveryFeesLBPShown,
        accountingCashed: Boolean(r.moved_to_history)
      };
    });

    return ok(res, withComputed, 'Orders fetched');
  } catch (err) {
    console.error('getEntityOrders error:', err);
    return fail(res, 500, 'Failed to fetch orders', err.message);
  }
}

async function cashout(req, res) {
  const client = require('pg').Client; // used via pool in run/query, we will rely on row-level updates
  try {
    const { orderId, mode } = req.body;
    if (!orderId || !mode) return fail(res, 400, 'orderId and mode are required');

    // Lock the order row
    const orderRows = await query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = orderRows[0];
    if (!order) return fail(res, 404, 'Order not found');
    if (order.status !== 'completed' || order.payment_status !== 'paid') {
      return fail(res, 400, 'Order not eligible for cashout');
    }
    if (order.moved_to_history || order.accounting_cashed) {
      return fail(res, 409, 'Order already cashed out');
    }

    const { computedTotalUSD, computedTotalLBP } = computeDisplayedAmounts(order);
    let amountUSD = 0;
    let amountLBP = 0;
    const m = String(mode).toLowerCase();
    if (m === 'clients') {
      amountUSD = computedTotalUSD; amountLBP = computedTotalLBP;
    } else if (m === 'drivers') {
      amountUSD = Number(order.driver_fee_usd || 0); amountLBP = Number(order.driver_fee_lbp || 0);
    } else if (m === 'third_party') {
      amountUSD = Number(order.driver_fee_usd || 0); amountLBP = Number(order.driver_fee_lbp || 0);
    } else {
      return fail(res, 400, 'Invalid mode');
    }

    // Record cashbox entry
    await run(`
      INSERT INTO cashbox_entries(order_id, entry_type, amount_usd, amount_lbp, actor_type, actor_id, description, created_by)
      VALUES(?, 'cash_in', ?, ?, ?, ?, ?, ?)
    `, [orderId, amountUSD, amountLBP, m.slice(0,-1), null, `Cashout for order ${order.order_ref}`, req.user?.id || null]);

    // Mark order moved to history
    await run('UPDATE orders SET moved_to_history = true, accounting_cashed = true, moved_at = now(), updated_at = now() WHERE id = ?', [orderId]);

    return ok(res, { orderId, amount_usd: amountUSD, amount_lbp: amountLBP }, 'Cashout completed');
  } catch (err) {
    console.error('cashout error:', err);
    return fail(res, 500, 'Failed to cashout order', err.message);
  }
}

module.exports = { getEntities, getEntityOrders, cashout };


