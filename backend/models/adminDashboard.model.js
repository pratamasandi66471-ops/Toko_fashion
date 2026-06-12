const db = require('../config/database');

const LOW_STOCK_THRESHOLD = 5;
const ALLOWED_RANGES = new Set(['day', 'week', 'month']);
const DEFAULT_DASHBOARD_SCHEMA = {
  orderDateCol: 'ordered_at',
  orderUserCol: 'customer_id',
  orderCodeCol: 'order_code',
  orderDisplayStatusCol: 'status',
  reviewMessageCol: 'message',
  reviewCustomerCol: 'customer_id',
  paidStatusFilter: `('paid')`,
  paidOrderItemSubtotalCol: 'subtotal',
};

let dashboardSchemaCache = null;
let dashboardSchemaLoading = null;

function hasColumn(columns, name) {
  return Boolean(columns && columns.has(name));
}

function columnRef(column, alias = '') {
  if (!alias) return column;
  return `${alias}.${column}`;
}

function pickColumn(columns, preferred, fallback) {
  if (hasColumn(columns, preferred)) return preferred;
  return fallback;
}

async function getTableColumns(tableName) {
  const rows = await db.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function getDashboardSchema() {
  if (dashboardSchemaCache) {
    return dashboardSchemaCache;
  }

  if (dashboardSchemaLoading) {
    return dashboardSchemaLoading;
  }

  dashboardSchemaLoading = (async () => {
    try {
      const [orderColumns, paymentColumns, reviewColumns, orderItemColumns] = await Promise.all([
        getTableColumns('orders'),
        getTableColumns('payments'),
        getTableColumns('reviews'),
        getTableColumns('order_items'),
      ]);

      const paidStatusFilter = hasColumn(paymentColumns, 'status') ? `('paid', 'success')` : `('paid')`;

      dashboardSchemaCache = {
        orderDateCol: pickColumn(orderColumns, 'ordered_at', 'created_at'),
        orderUserCol: pickColumn(orderColumns, 'customer_id', 'user_id'),
        orderCodeCol: pickColumn(orderColumns, 'order_code', 'invoice_number'),
        orderDisplayStatusCol: pickColumn(orderColumns, 'status', 'order_status'),
        reviewMessageCol: pickColumn(reviewColumns, 'message', 'comment'),
        reviewCustomerCol: pickColumn(reviewColumns, 'customer_id', 'user_id'),
        paidStatusFilter,
        paidOrderItemSubtotalCol: pickColumn(orderItemColumns, 'subtotal', 'total'),
      };

      return dashboardSchemaCache;
    } catch (_error) {
      dashboardSchemaCache = { ...DEFAULT_DASHBOARD_SCHEMA };
      return dashboardSchemaCache;
    } finally {
      dashboardSchemaLoading = null;
    }
  })();

  return dashboardSchemaLoading;
}

function safeRange(range) {
  if (!range || !ALLOWED_RANGES.has(range)) {
    return 'month';
  }

  return range;
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentChange(current, previous) {
  const c = toNumber(current);
  const p = toNumber(previous);

  if (p === 0) {
    if (c === 0) return 0;
    return 100;
  }

  return ((c - p) / p) * 100;
}

async function queryOne(sql, params = [], fallback = { value: 0 }) {
  const rows = await db.query(sql, params);
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0]) {
    return { ...fallback };
  }

  return rows[0];
}

async function queryAll(sql, params = []) {
  const rows = await db.query(sql, params);
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows;
}

async function getKpis() {
  const schema = await getDashboardSchema();
  const orderDateExpr = columnRef(schema.orderDateCol);
  const paidStatusFilter = schema.paidStatusFilter;

  const [
    totalRevenue,
    totalOrders,
    totalProducts,
    totalCustomers,
    lowStockProducts,
    outOfStockProducts,
    pendingOrders,
    completedOrders,
    newCustomersToday,
    totalStaff,
    salesThisMonth,
    revenueToday,
    revenueYesterday,
    ordersToday,
    ordersYesterday,
    newCustomersYesterday,
  ] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE status IN ${paidStatusFilter}`),
    queryOne(`SELECT COUNT(*) AS value FROM orders`),
    queryOne(`SELECT COUNT(*) AS value FROM products WHERE status = 'active'`),
    queryOne(`SELECT COUNT(*) AS value FROM users WHERE role = 'customer'`),
    queryOne(
      `SELECT COUNT(DISTINCT CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN p.id END) AS value
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       WHERE p.status = 'active'`,
      [LOW_STOCK_THRESHOLD]
    ),
    queryOne(
      `SELECT COUNT(DISTINCT CASE WHEN pv.stock = 0 THEN p.id END) AS value
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       WHERE p.status = 'active'`
    ),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE order_status = 'pending'`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE order_status = 'completed'`),
    queryOne(`SELECT COUNT(*) AS value FROM users WHERE role = 'customer' AND DATE(created_at) = CURDATE()`),
    queryOne(`SELECT COUNT(*) AS value FROM users WHERE role = 'staff'`),
    queryOne(`SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE status IN ${paidStatusFilter} AND DATE_FORMAT(paid_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`),
    queryOne(`SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE status IN ${paidStatusFilter} AND DATE(paid_at) = CURDATE()`),
    queryOne(`SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE status IN ${paidStatusFilter} AND DATE(paid_at) = CURDATE() - INTERVAL 1 DAY`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE DATE(${orderDateExpr}) = CURDATE()`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE DATE(${orderDateExpr}) = CURDATE() - INTERVAL 1 DAY`),
    queryOne(`SELECT COUNT(*) AS value FROM users WHERE role = 'customer' AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY`),
  ]);

  return {
    totalRevenue: toNumber(totalRevenue.value),
    totalOrders: toNumber(totalOrders.value),
    totalProducts: toNumber(totalProducts.value),
    totalCustomers: toNumber(totalCustomers.value),
    lowStockProducts: toNumber(lowStockProducts.value),
    outOfStockProducts: toNumber(outOfStockProducts.value),
    pendingOrders: toNumber(pendingOrders.value),
    completedOrders: toNumber(completedOrders.value),
    newCustomersToday: toNumber(newCustomersToday.value),
    totalStaff: toNumber(totalStaff.value),
    salesThisMonth: toNumber(salesThisMonth.value),
    deltas: {
      revenueTodayVsYesterdayPct: percentChange(revenueToday.value, revenueYesterday.value),
      ordersTodayVsYesterdayPct: percentChange(ordersToday.value, ordersYesterday.value),
      customersTodayVsYesterdayPct: percentChange(newCustomersToday.value, newCustomersYesterday.value),
    },
  };
}

async function getStripMetrics() {
  const schema = await getDashboardSchema();
  const orderDateExpr = columnRef(schema.orderDateCol);
  const paidStatusFilter = schema.paidStatusFilter;

  const [revenueToday, ordersToday, pendingCount, lowStockCount, newCustomers, completedCount] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE status IN ${paidStatusFilter} AND DATE(paid_at) = CURDATE()`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE DATE(${orderDateExpr}) = CURDATE()`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE order_status = 'pending'`),
    queryOne(
      `SELECT COUNT(DISTINCT CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN p.id END) AS value
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       WHERE p.status = 'active'`,
      [LOW_STOCK_THRESHOLD]
    ),
    queryOne(`SELECT COUNT(*) AS value FROM users WHERE role = 'customer' AND created_at >= CURDATE() - INTERVAL 6 DAY`),
    queryOne(`SELECT COUNT(*) AS value FROM orders WHERE order_status = 'completed'`),
  ]);

  return {
    revenueToday: toNumber(revenueToday.value),
    ordersToday: toNumber(ordersToday.value),
    pendingOrders: toNumber(pendingCount.value),
    lowStockProducts: toNumber(lowStockCount.value),
    newCustomers7Days: toNumber(newCustomers.value),
    completedOrders: toNumber(completedCount.value),
  };
}

function buildDaySeriesMap(days) {
  const labels = [];
  const keys = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Jakarta',
    });
    keys.push(key);
    labels.push(label);
  }

  return { labels, keys };
}

function buildMonthSeriesMap(months) {
  const labels = [];
  const keys = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    const label = date.toLocaleDateString('id-ID', {
      month: 'short',
      year: '2-digit',
      timeZone: 'Asia/Jakarta',
    });

    keys.push(key);
    labels.push(label);
  }

  return { labels, keys };
}

async function getSalesSeries(range) {
  const schema = await getDashboardSchema();
  const orderDateExpr = columnRef(schema.orderDateCol);
  const safe = safeRange(range);

  if (safe === 'month') {
    const map = buildMonthSeriesMap(6);
    const rows = await queryAll(
      `SELECT DATE_FORMAT(${orderDateExpr}, '%Y-%m') AS period_key,
              COALESCE(SUM(total_amount), 0) AS total
       FROM orders
       WHERE payment_status = 'paid'
         AND ${orderDateExpr} >= DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01')
       GROUP BY DATE_FORMAT(${orderDateExpr}, '%Y-%m')
       ORDER BY period_key ASC`
    );

    const byKey = new Map(rows.map((row) => [row.period_key, toNumber(row.total)]));
    return {
      labels: map.labels,
      data: map.keys.map((key) => byKey.get(key) || 0),
      range: safe,
    };
  }

  const dayWindow = safe === 'week' ? 28 : 7;
  const map = buildDaySeriesMap(dayWindow);
  const rows = await queryAll(
    `SELECT DATE(${orderDateExpr}) AS period_key,
            COALESCE(SUM(total_amount), 0) AS total
     FROM orders
     WHERE payment_status = 'paid'
       AND ${orderDateExpr} >= CURDATE() - INTERVAL ? DAY
     GROUP BY DATE(${orderDateExpr})
     ORDER BY DATE(${orderDateExpr}) ASC`,
    [dayWindow - 1]
  );

  const byKey = new Map(rows.map((row) => [String(row.period_key).slice(0, 10), toNumber(row.total)]));
  return {
    labels: map.labels,
    data: map.keys.map((key) => byKey.get(key) || 0),
    range: safe,
  };
}

async function getOrderStatusDistribution() {
  const schema = await getDashboardSchema();
  const orderDisplayStatusExpr = columnRef(schema.orderDisplayStatusCol);

  const rows = await queryAll(
    `SELECT ${orderDisplayStatusExpr} AS status, COUNT(*) AS total
     FROM orders
     GROUP BY ${orderDisplayStatusExpr}
     ORDER BY FIELD(${orderDisplayStatusExpr}, 'pending', 'processing', 'confirmed', 'packed', 'shipped', 'completed', 'cancelled')`
  );

  return rows.map((row) => ({
    label: row.status,
    total: toNumber(row.total),
  }));
}

async function getCustomerGrowthThisMonth() {
  const rows = await queryAll(
    `SELECT DATE(created_at) AS day_key, COUNT(*) AS total
     FROM users
     WHERE role = 'customer'
       AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) ASC`
  );

  const now = new Date();
  const totalDays = now.getDate();
  const labels = [];
  const data = [];
  const counts = new Map(rows.map((row) => [String(row.day_key).slice(0, 10), toNumber(row.total)]));

  let cumulative = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const base = new Date(now.getFullYear(), now.getMonth(), day);
    const key = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    cumulative += counts.get(key) || 0;

    labels.push(base.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Jakarta',
    }));
    data.push(cumulative);
  }

  return { labels, data };
}

async function getRevenueByCategoryThisMonth() {
  const schema = await getDashboardSchema();
  const orderDateExpr = columnRef(schema.orderDateCol, 'o');
  const subtotalExpr = columnRef(schema.paidOrderItemSubtotalCol, 'oi');

  const rows = await queryAll(
    `SELECT c.name AS category_name,
            COALESCE(SUM(CASE
              WHEN o.payment_status = 'paid'
               AND DATE_FORMAT(${orderDateExpr}, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
              THEN ${subtotalExpr}
              ELSE 0
            END), 0) AS revenue
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     GROUP BY c.id, c.name
     ORDER BY revenue DESC`
  );

  return rows
    .filter((row) => toNumber(row.revenue) > 0)
    .map((row) => ({
      label: row.category_name,
      value: toNumber(row.revenue),
    }));
}

async function getTopSellingProducts(limit = 5) {
  return queryAll(
    `SELECT p.sku, p.name, p.price,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) AS sold_qty
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     GROUP BY p.id, p.sku, p.name, p.price
     HAVING sold_qty > 0
     ORDER BY sold_qty DESC, p.name ASC
     LIMIT ?`,
    [limit]
  );
}

async function getRecentOrders(limit = 6) {
  const schema = await getDashboardSchema();
  const orderCodeExpr = columnRef(schema.orderCodeCol, 'o');
  const orderDisplayStatusExpr = columnRef(schema.orderDisplayStatusCol, 'o');
  const orderDateExpr = columnRef(schema.orderDateCol, 'o');
  const orderUserExpr = columnRef(schema.orderUserCol, 'o');

  return queryAll(
    `SELECT ${orderCodeExpr} AS order_code, ${orderDisplayStatusExpr} AS status, o.total_amount, ${orderDateExpr} AS ordered_at,
            COALESCE(u.name, 'Unknown Customer') AS customer_name
     FROM orders o
     LEFT JOIN users u ON u.id = ${orderUserExpr}
     ORDER BY ${orderDateExpr} DESC
     LIMIT ?`,
    [limit]
  );
}

async function getLowStockProducts(limit = 6, lowStockThreshold = LOW_STOCK_THRESHOLD) {
  return queryAll(
    `SELECT p.id, p.sku, p.name,
            MIN(CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN pv.stock END) AS stock
     FROM products p
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     WHERE p.status = 'active'
     GROUP BY p.id, p.sku, p.name
     HAVING stock IS NOT NULL
     ORDER BY stock ASC, p.name ASC
     LIMIT ?`,
    [lowStockThreshold, limit]
  );
}

async function getBestSellingProducts(limit = 5) {
  const schema = await getDashboardSchema();
  const subtotalExpr = columnRef(schema.paidOrderItemSubtotalCol, 'oi');

  return queryAll(
    `SELECT p.sku, p.name,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) AS sold_qty,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN ${subtotalExpr} ELSE 0 END), 0) AS total_revenue,
            COALESCE(AVG(r.rating), 0) AS avg_rating,
            COUNT(DISTINCT r.id) AS rating_count
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     LEFT JOIN reviews r ON r.product_id = p.id
     GROUP BY p.id, p.sku, p.name
     HAVING sold_qty > 0
     ORDER BY sold_qty DESC, total_revenue DESC, p.name ASC
     LIMIT ?`,
    [limit]
  );
}

async function getRecentCustomers(limit = 6) {
  return queryAll(
    `SELECT name, email, created_at
     FROM users
     WHERE role = 'customer'
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function getRecentReviews(limit = 6) {
  const schema = await getDashboardSchema();
  const reviewMessageExpr = columnRef(schema.reviewMessageCol, 'r');
  const reviewCustomerExpr = columnRef(schema.reviewCustomerCol, 'r');

  return queryAll(
    `SELECT r.rating, ${reviewMessageExpr} AS message, r.created_at,
            u.name AS customer_name,
            p.name AS product_name
     FROM reviews r
     LEFT JOIN users u ON u.id = ${reviewCustomerExpr}
     LEFT JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function getTablesData() {
  const [topSellingProducts, bestSellingProducts, recentOrders, lowStockProducts, recentCustomers, recentReviews] = await Promise.all([
    getTopSellingProducts(5),
    getBestSellingProducts(5),
    getRecentOrders(6),
    getLowStockProducts(6, LOW_STOCK_THRESHOLD),
    getRecentCustomers(6),
    getRecentReviews(6),
  ]);

  return {
    topSellingProducts,
    bestSellingProducts,
    recentOrders,
    lowStockProducts,
    recentCustomers,
    recentReviews,
  };
}

async function getDashboardData(range = 'month') {
  const safe = safeRange(range);
  const [kpis, strip, salesSeries, orderStatus, customerGrowth, categoryRevenue, tables] = await Promise.all([
    getKpis(),
    getStripMetrics(),
    getSalesSeries(safe),
    getOrderStatusDistribution(),
    getCustomerGrowthThisMonth(),
    getRevenueByCategoryThisMonth(),
    getTablesData(),
  ]);

  return {
    range: safe,
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Jakarta',
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    kpis,
    strip,
    salesSeries,
    orderStatus,
    customerGrowth,
    categoryRevenue,
    tables,
  };
}

module.exports = {
  queryOne,
  queryAll,
  getKpis,
  getRecentOrders,
  getLowStockProducts,
  getBestSellingProducts,
  getRecentCustomers,
  getDashboardData,
  safeRange,
};
