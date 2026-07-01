const db = require('../config/database');
const stockService = require('../services/stock.service');
const orderService = require('../services/order.service');

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';
const STAFF_ORDER_STATUSES = new Set(Array.from(orderService.ALLOWED_MAIN_STATUSES));
const ORDER_STATUS_MAP = orderService.MAIN_TO_ORDER_STATUS;
const ALLOWED_TRANSITIONS = orderService.STAFF_ALLOWED_TRANSITIONS;
const ALLOWED_STOCK_FILTERS = new Set(['available', 'low', 'out']);
const ALLOWED_VARIANT_STATUSES = new Set(['active', 'inactive']);

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function domainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildOrderFilters({ q = '', status = '' } = {}) {
  const allowedStatuses = Array.from(orderService.ALLOWED_MAIN_STATUSES);
  const where = ['o.status IN (?'.concat(', ?'.repeat(allowedStatuses.length - 1), ')').split('?').map((_, i) => i === 0 ? 'o.status IN (' : '').join('') + allowedStatuses.map(() => '?').join(', ') + ')'];
  const params = [...allowedStatuses];
  const search = String(q || '').trim();
  const statusFilter = String(status || '').trim().toLowerCase();

  if (search) {
    where.push('(o.invoice_number LIKE ? OR o.order_code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (STAFF_ORDER_STATUSES.has(statusFilter)) {
    where.push('o.status = ?');
    params.push(statusFilter);
  }

  return {
    whereSql: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

function buildStockFilters({ q = '', stock = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const search = String(q || '').trim();
  const stockFilter = String(stock || '').trim().toLowerCase();
  const statusFilter = String(status || '').trim().toLowerCase();

  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR pv.variant_sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (ALLOWED_STOCK_FILTERS.has(stockFilter)) {
    if (stockFilter === 'available') {
      where.push('pv.stock > ?');
      params.push(LOW_STOCK_THRESHOLD);
    } else if (stockFilter === 'low') {
      where.push('pv.stock > 0 AND pv.stock <= ?');
      params.push(LOW_STOCK_THRESHOLD);
    } else if (stockFilter === 'out') {
      where.push('pv.stock = 0');
    }
  }

  if (ALLOWED_VARIANT_STATUSES.has(statusFilter)) {
    where.push('pv.status = ?');
    params.push(statusFilter);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

function buildProductFilters({ q = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const search = String(q || '').trim();
  const statusFilter = String(status || '').trim().toLowerCase();

  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (['draft', 'active', 'inactive'].includes(statusFilter)) {
    where.push('p.status = ?');
    params.push(statusFilter);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function getDashboardSummary() {
  const [orders, stocks] = await Promise.all([
    db.query(
      `SELECT
         COUNT(CASE WHEN o.status = 'pending' THEN 1 END) AS pendingOrders,
         COUNT(CASE WHEN o.status = 'processing' THEN 1 END) AS processingOrders,
         COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) AS shippedOrders
       FROM orders o`
    ),
    db.query(
      `SELECT
         COUNT(CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN 1 END) AS lowStockVariants,
         COUNT(CASE WHEN pv.stock = 0 THEN 1 END) AS outOfStockVariants
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id`,
      [LOW_STOCK_THRESHOLD]
    ),
  ]);

  return {
    pendingOrders: Number(orders[0]?.pendingOrders || 0),
    processingOrders: Number(orders[0]?.processingOrders || 0),
    shippedOrders: Number(orders[0]?.shippedOrders || 0),
    lowStockVariants: Number(stocks[0]?.lowStockVariants || 0),
    outOfStockVariants: Number(stocks[0]?.outOfStockVariants || 0),
  };
}

async function listOrders({ q = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildOrderFilters({ q, status });

  return db.query(
    `SELECT o.id, o.invoice_number, o.order_code, o.total_amount, o.status,
            o.order_status, o.payment_status AS order_payment_status,
            o.courier, o.tracking_number, o.ordered_at, o.created_at,
            u.name AS customer_name, u.email AS customer_email,
            pay.status AS payment_record_status,
            COALESCE(NULLIF(pay.status, ''), NULLIF(o.payment_status, ''), 'unpaid') AS display_payment_status
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN payments pay ON pay.id = (
       SELECT pay2.id
       FROM payments pay2
       WHERE pay2.order_id = o.id
       ORDER BY pay2.created_at DESC, pay2.id DESC
       LIMIT 1
     )
     ${whereSql}
     ORDER BY COALESCE(o.ordered_at, o.created_at) DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countOrders({ q = '', status = '' } = {}) {
  const { whereSql, params } = buildOrderFilters({ q, status });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT o.id) AS total
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN payments pay ON pay.id = (
       SELECT pay2.id
       FROM payments pay2
       WHERE pay2.order_id = o.id
       ORDER BY pay2.created_at DESC, pay2.id DESC
       LIMIT 1
     )
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getOrderDetail(orderId) {
  const rows = await db.query(
    `SELECT o.id, o.customer_id, o.address_id, o.invoice_number, o.order_code,
            o.subtotal, o.shipping_cost, o.discount_amount, o.total_amount,
            o.status, o.order_status, o.payment_status AS order_payment_status,
            o.courier, o.tracking_number, o.notes, o.ordered_at, o.created_at, o.updated_at,
            u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
            a.recipient_name, a.phone AS address_phone, a.province, a.city, a.district,
            a.postal_code, a.full_address,
            pay.method AS payment_method, pay.payment_method AS payment_method_alt,
            pay.payment_provider, pay.transaction_id, pay.amount AS payment_amount,
            pay.status AS payment_record_status, pay.paid_at AS payment_paid_at,
            COALESCE(NULLIF(pay.status, ''), NULLIF(o.payment_status, ''), 'unpaid') AS display_payment_status
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN payments pay ON pay.id = (
       SELECT pay2.id
       FROM payments pay2
       WHERE pay2.order_id = o.id
       ORDER BY pay2.created_at DESC, pay2.id DESC
       LIMIT 1
     )
     WHERE o.id = ?
       AND o.status IN ('pending', 'processing', 'shipped', 'completed')
     LIMIT 1`,
    [orderId]
  );

  return rows[0] || null;
}

async function getOrderItems(orderId) {
  return db.query(
    `SELECT oi.id, oi.product_name, oi.size, oi.color, oi.variant_sku,
            COALESCE(oi.unit_price, oi.price, 0) AS display_price,
            oi.quantity,
            COALESCE(oi.total, oi.subtotal, oi.unit_price * oi.quantity, oi.price * oi.quantity, 0) AS display_total
     FROM order_items oi
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );
}

async function updateOrderStatus(orderId, newStatus) {
  const status = orderService.normalizeOrderStatus(newStatus);
  if (!status) {
    throw domainError('INVALID_STATUS', 'Status order tidak valid untuk staff.');
  }

  const rows = await db.query(
    `SELECT o.id, o.status, o.courier, o.tracking_number
     FROM orders o
     WHERE o.id = ?
       AND o.status IN (${Array.from(orderService.ALLOWED_MAIN_STATUSES).map(() => '?').join(', ')})
     LIMIT 1`,
    [orderId, ...Array.from(orderService.ALLOWED_MAIN_STATUSES)]
  );
  const order = rows[0];

  if (!order) {
    throw domainError('ORDER_NOT_FOUND', 'Order tidak ditemukan.');
  }

  // Validate staff-restricted transition using order service
  try {
    orderService.validateStaffOrderStatusTransition(order.status, status);
  } catch (error) {
    throw domainError('INVALID_TRANSITION', error.message);
  }

  if (status === 'shipped' && (!order.courier || !order.tracking_number)) {
    throw domainError('TRACKING_REQUIRED', 'Courier dan tracking number wajib diisi sebelum order dikirim.');
  }

  const orderStatus = orderService.mapMainStatusToOrderStatus(status);
  const result = await db.query(
    `UPDATE orders o
     SET o.status = ?,
         o.order_status = ?,
         o.updated_at = NOW()
     WHERE o.id = ?`,
    [status, orderStatus, orderId]
  );

  return result.affectedRows > 0;
}

async function updateTracking(orderId, { courier, trackingNumber }) {
  const result = await db.query(
    `UPDATE orders o
     SET o.courier = ?,
         o.tracking_number = ?,
         o.updated_at = NOW()
     WHERE o.id = ?
       AND o.status IN ('pending', 'processing', 'shipped')`,
    [
      String(courier || '').trim() || null,
      String(trackingNumber || '').trim() || null,
      orderId,
    ]
  );

  return result.affectedRows > 0;
}

async function listStocks({ q = '', stock = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildStockFilters({ q, stock, status });

  return db.query(
    `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.color_code, pv.stock,
            pv.status AS variant_status, pv.variant_sku, pv.updated_at AS variant_updated_at,
            p.name AS product_name, p.slug AS product_slug, p.sku AS product_sku, p.status AS product_status,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     ${whereSql}
     GROUP BY pv.id, pv.product_id, pv.size, pv.color, pv.color_code, pv.stock,
              pv.status, pv.variant_sku, pv.updated_at, p.name, p.slug, p.sku, p.status
     ORDER BY
       CASE
         WHEN pv.stock = 0 THEN 0
         WHEN pv.stock > 0 AND pv.stock <= ? THEN 1
         ELSE 2
       END ASC,
       pv.updated_at DESC,
       pv.id DESC
     LIMIT ? OFFSET ?`,
    [PRODUCT_IMAGE_FALLBACK, ...params, LOW_STOCK_THRESHOLD, safeLimit, offset]
  );
}

async function countStocks({ q = '', stock = '', status = '' } = {}) {
  const { whereSql, params } = buildStockFilters({ q, stock, status });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT pv.id) AS total
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function findVariantById(variantId) {
  const rows = await db.query(
    `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.stock,
            pv.status AS variant_status, pv.variant_sku,
            p.name AS product_name, p.sku AS product_sku
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.id = ?
     LIMIT 1`,
    [variantId]
  );

  return rows[0] || null;
}

async function updateVariantStock(variantId, stock) {
  return stockService.setStock(null, variantId, stock);
}

async function listProducts({ q = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildProductFilters({ q, status });

  return db.query(
    `SELECT p.id, p.name, p.slug, p.sku, p.status AS product_status,
            c.name AS category_name,
            COUNT(DISTINCT pv.id) AS variant_count,
            COALESCE(SUM(CASE WHEN pv.status = 'active' THEN pv.stock ELSE 0 END), 0) AS total_stock,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     ${whereSql}
     GROUP BY p.id, p.name, p.slug, p.sku, p.status, c.name
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [PRODUCT_IMAGE_FALLBACK, ...params, safeLimit, offset]
  );
}

async function countProducts({ q = '', status = '' } = {}) {
  const { whereSql, params } = buildProductFilters({ q, status });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM products p
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  STAFF_ORDER_STATUSES,
  getDashboardSummary,
  listOrders,
  countOrders,
  getOrderDetail,
  getOrderItems,
  updateOrderStatus,
  updateTracking,
  listStocks,
  countStocks,
  findVariantById,
  updateVariantStock,
  listProducts,
  countProducts,
};
