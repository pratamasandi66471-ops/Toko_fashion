const db = require('../config/database');

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_PRODUCTS_LIMIT = 10;
const DEFAULT_CUSTOMERS_LIMIT = 10;

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function buildDateFilter({ dateFrom, dateTo } = {}, alias = 'o') {
  const conditions = [];
  const params = [];
  const dateExpr = `COALESCE(${alias}.ordered_at, ${alias}.created_at)`;

  if (dateFrom) {
    conditions.push(`${dateExpr} >= ?`);
    params.push(`${dateFrom} 00:00:00`);
  }

  if (dateTo) {
    conditions.push(`${dateExpr} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(`${dateTo} 00:00:00`);
  }

  return {
    whereSql: conditions.length ? `AND ${conditions.join(' AND ')}` : '',
    params,
    dateExpr,
  };
}

function buildUserDateFilter({ dateFrom, dateTo } = {}) {
  const conditions = [];
  const params = [];

  if (dateFrom) {
    conditions.push('u.created_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }

  if (dateTo) {
    conditions.push('u.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${dateTo} 00:00:00`);
  }

  return {
    whereSql: conditions.length ? `AND ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function getSalesSummary({ dateFrom, dateTo } = {}) {
  const { whereSql, params } = buildDateFilter({ dateFrom, dateTo }, 'o');
  const rows = await db.query(
    `SELECT COALESCE(SUM(o.total_amount), 0) AS totalRevenue,
            COUNT(o.id) AS paidOrders,
            COALESCE(AVG(o.total_amount), 0) AS averageOrderValue,
            COALESCE(SUM(o.discount_amount), 0) AS totalDiscount,
            COALESCE(SUM(o.shipping_cost), 0) AS totalShipping
     FROM orders o
     WHERE o.payment_status = 'paid'
     ${whereSql}`,
    params
  );

  const summary = rows[0] || {};
  return {
    totalRevenue: Number(summary.totalRevenue || 0),
    paidOrders: Number(summary.paidOrders || 0),
    averageOrderValue: Number(summary.averageOrderValue || 0),
    totalDiscount: Number(summary.totalDiscount || 0),
    totalShipping: Number(summary.totalShipping || 0),
  };
}

async function getRevenueByDate({ dateFrom, dateTo } = {}) {
  const { whereSql, params, dateExpr } = buildDateFilter({ dateFrom, dateTo }, 'o');

  return db.query(
    `SELECT DATE(${dateExpr}) AS report_date,
            COALESCE(SUM(o.total_amount), 0) AS revenue,
            COUNT(o.id) AS order_count
     FROM orders o
     WHERE o.payment_status = 'paid'
     ${whereSql}
     GROUP BY DATE(${dateExpr})
     ORDER BY DATE(${dateExpr}) ASC`,
    params
  );
}

async function getOrdersSummary({ dateFrom, dateTo } = {}) {
  const { whereSql, params } = buildDateFilter({ dateFrom, dateTo }, 'o');
  const rows = await db.query(
    `SELECT COUNT(o.id) AS totalOrders,
            COUNT(CASE WHEN o.status = 'pending' THEN 1 END) AS pendingOrders,
            COUNT(CASE WHEN o.status = 'processing' THEN 1 END) AS processingOrders,
            COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) AS shippedOrders,
            COUNT(CASE WHEN o.status = 'completed' THEN 1 END) AS completedOrders,
            COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelledOrders,
            COUNT(CASE WHEN o.payment_status = 'unpaid' THEN 1 END) AS unpaidOrders,
            COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paidOrders,
            COUNT(CASE WHEN o.payment_status = 'failed' THEN 1 END) AS failedPayments
     FROM orders o
     WHERE 1 = 1
     ${whereSql}`,
    params
  );

  const summary = rows[0] || {};
  return {
    totalOrders: Number(summary.totalOrders || 0),
    pendingOrders: Number(summary.pendingOrders || 0),
    processingOrders: Number(summary.processingOrders || 0),
    shippedOrders: Number(summary.shippedOrders || 0),
    completedOrders: Number(summary.completedOrders || 0),
    cancelledOrders: Number(summary.cancelledOrders || 0),
    unpaidOrders: Number(summary.unpaidOrders || 0),
    paidOrders: Number(summary.paidOrders || 0),
    failedPayments: Number(summary.failedPayments || 0),
  };
}

async function getOrdersByStatus({ dateFrom, dateTo } = {}) {
  const { whereSql, params } = buildDateFilter({ dateFrom, dateTo }, 'o');

  return db.query(
    `SELECT o.status, COUNT(o.id) AS total
     FROM orders o
     WHERE 1 = 1
     ${whereSql}
     GROUP BY o.status
     ORDER BY FIELD(o.status, 'pending', 'processing', 'shipped', 'completed', 'cancelled'), o.status ASC`,
    params
  );
}

async function getProductsReport({ dateFrom, dateTo, limit = DEFAULT_PRODUCTS_LIMIT } = {}) {
  const safeLimit = normalizeLimit(limit, DEFAULT_PRODUCTS_LIMIT);
  const { whereSql, params } = buildDateFilter({ dateFrom, dateTo }, 'o');

  return db.query(
    `SELECT p.id AS product_id,
            COALESCE(p.name, oi.product_name) AS product_name,
            p.sku,
            COALESCE(SUM(oi.quantity), 0) AS sold_qty,
            COALESCE(SUM(COALESCE(oi.total, oi.subtotal, oi.unit_price * oi.quantity, oi.price * oi.quantity, 0)), 0) AS revenue,
            COUNT(DISTINCT o.id) AS order_count
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.payment_status = 'paid'
     ${whereSql}
     GROUP BY p.id, p.name, p.sku, oi.product_name
     HAVING sold_qty > 0
     ORDER BY sold_qty DESC, revenue DESC, product_name ASC
     LIMIT ?`,
    [...params, safeLimit]
  );
}

async function getInventoryReport() {
  const rows = await db.query(
    `SELECT COUNT(pv.id) AS totalVariants,
            COALESCE(SUM(pv.stock), 0) AS totalStock,
            COUNT(CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN 1 END) AS lowStockVariants,
            COUNT(CASE WHEN pv.stock = 0 THEN 1 END) AS outOfStockVariants
     FROM product_variants pv`,
    [LOW_STOCK_THRESHOLD]
  );

  const report = rows[0] || {};
  return {
    totalVariants: Number(report.totalVariants || 0),
    totalStock: Number(report.totalStock || 0),
    lowStockVariants: Number(report.lowStockVariants || 0),
    outOfStockVariants: Number(report.outOfStockVariants || 0),
  };
}

async function getCustomersReport({ dateFrom, dateTo, limit = DEFAULT_CUSTOMERS_LIMIT } = {}) {
  const safeLimit = normalizeLimit(limit, DEFAULT_CUSTOMERS_LIMIT);
  const orderFilter = buildDateFilter({ dateFrom, dateTo }, 'o');
  const userFilter = buildUserDateFilter({ dateFrom, dateTo });

  const [totalRows, topCustomersBySpending, topCustomersByOrderCount] = await Promise.all([
    db.query(
      `SELECT COUNT(u.id) AS totalCustomers,
              COUNT(CASE WHEN u.created_at IS NOT NULL ${userFilter.whereSql} THEN 1 END) AS newCustomers
       FROM users u
       WHERE u.role = 'customer'`,
      userFilter.params
    ),
    db.query(
      `SELECT u.id AS customer_id, u.name, u.email,
              COUNT(DISTINCT o.id) AS total_orders,
              COALESCE(SUM(o.total_amount), 0) AS total_spent
       FROM users u
       INNER JOIN orders o ON o.customer_id = u.id
       WHERE u.role = 'customer'
         AND o.payment_status = 'paid'
         ${orderFilter.whereSql}
       GROUP BY u.id, u.name, u.email
       HAVING total_spent > 0
       ORDER BY total_spent DESC, total_orders DESC, u.name ASC
       LIMIT ?`,
      [...orderFilter.params, safeLimit]
    ),
    db.query(
      `SELECT u.id AS customer_id, u.name, u.email,
              COUNT(DISTINCT o.id) AS total_orders,
              COALESCE(SUM(o.total_amount), 0) AS total_spent
       FROM users u
       INNER JOIN orders o ON o.customer_id = u.id
       WHERE u.role = 'customer'
         AND o.payment_status = 'paid'
         ${orderFilter.whereSql}
       GROUP BY u.id, u.name, u.email
       HAVING total_orders > 0
       ORDER BY total_orders DESC, total_spent DESC, u.name ASC
       LIMIT ?`,
      [...orderFilter.params, safeLimit]
    ),
  ]);

  const totals = totalRows[0] || {};
  return {
    totalCustomers: Number(totals.totalCustomers || 0),
    newCustomers: Number(totals.newCustomers || 0),
    topCustomersBySpending,
    topCustomersByOrderCount,
  };
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  getSalesSummary,
  getRevenueByDate,
  getOrdersSummary,
  getOrdersByStatus,
  getProductsReport,
  getInventoryReport,
  getCustomersReport,
};
