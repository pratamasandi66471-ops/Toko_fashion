const db = require('../config/database');
const orderService = require('../services/order.service');
const stockService = require('../services/stock.service');

const ALLOWED_ORDER_STATUSES = orderService.ALLOWED_MAIN_STATUSES;

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

function normalizeOrderStatus(value) {
  return orderService.normalizeOrderStatus(value);
}

function buildOrderFilters({ q = '', orderStatus = '', paymentStatus = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeOrderStatus = normalizeOrderStatus(orderStatus);
  const safePaymentStatus = String(paymentStatus || '').trim().toLowerCase();

  if (keyword) {
    where.push('(o.invoice_number LIKE ? OR o.order_code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeOrderStatus) {
    where.push('o.status = ?');
    params.push(safeOrderStatus);
  }

  if (safePaymentStatus) {
    where.push('(p.status = ? OR o.payment_status = ?)');
    params.push(safePaymentStatus, safePaymentStatus);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

function assertAllowedOrderStatus(status) {
  return orderService.assertAllowedOrderStatus(status);
}

async function listOrders({ q = '', orderStatus = '', paymentStatus = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildOrderFilters({ q, orderStatus, paymentStatus });

  return db.query(
    `SELECT o.id, o.invoice_number, o.order_code, o.total_amount, o.status, o.order_status,
            o.payment_status AS order_payment_status, o.ordered_at, o.created_at,
            u.name AS customer_name, u.email AS customer_email,
            p.status AS payment_record_status, p.method AS payment_method, p.payment_method AS payment_method_alt,
            COALESCE(NULLIF(p.status, ''), NULLIF(o.payment_status, ''), 'unpaid') AS display_payment_status
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id
       FROM payments p2
       WHERE p2.order_id = o.id
       ORDER BY p2.created_at DESC, p2.id DESC
       LIMIT 1
     )
     ${whereSql}
     ORDER BY COALESCE(o.ordered_at, o.created_at) DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countOrders({ q = '', orderStatus = '', paymentStatus = '' } = {}) {
  const { whereSql, params } = buildOrderFilters({ q, orderStatus, paymentStatus });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT o.id) AS total
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id
       FROM payments p2
       WHERE p2.order_id = o.id
       ORDER BY p2.created_at DESC, p2.id DESC
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
            p.id AS payment_id, p.method AS payment_method, p.payment_method AS payment_method_alt,
            p.payment_provider, p.transaction_id, p.amount AS payment_amount,
            p.status AS payment_record_status, p.paid_at AS payment_paid_at,
            COALESCE(NULLIF(p.status, ''), NULLIF(o.payment_status, ''), 'unpaid') AS display_payment_status
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id
       FROM payments p2
       WHERE p2.order_id = o.id
       ORDER BY p2.created_at DESC, p2.id DESC
       LIMIT 1
     )
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );

  return rows[0] || null;
}

async function getOrderItems(orderId) {
  return db.query(
    `SELECT oi.id, oi.product_name, oi.size, oi.color, oi.variant_sku,
            COALESCE(oi.unit_price, oi.price, 0) AS display_price,
            oi.price, oi.unit_price, oi.quantity,
            COALESCE(oi.total, oi.subtotal, oi.unit_price * oi.quantity, oi.price * oi.quantity, 0) AS display_total,
            oi.total, oi.subtotal
     FROM order_items oi
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );
}

async function updateOrderStatus(orderId, newStatus) {
  const status = normalizeOrderStatus(newStatus);
  assertAllowedOrderStatus(status);
  const orderStatus = orderService.mapMainStatusToOrderStatus(status);

  const result = await db.query(
    `UPDATE orders o
     SET o.status = ?,
         o.order_status = ?,
         o.updated_at = NOW()
     WHERE o.id = ?`,
    [status, orderStatus, orderId]
  );

  return result.affectedRows || 0;
}

async function updateTracking(orderId, { courier, trackingNumber }) {
  const result = await db.query(
    `UPDATE orders o
     SET o.courier = ?,
         o.tracking_number = ?,
         o.updated_at = NOW()
     WHERE o.id = ?`,
    [
      String(courier || '').trim() || null,
      String(trackingNumber || '').trim() || null,
      orderId,
    ]
  );

  return result.affectedRows || 0;
}

async function cancelOrder(orderId) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.execute(
      `SELECT o.id, o.status
       FROM orders o
       WHERE o.id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return 0;
    }

    if (!orderService.canCancelOrder(order.status)) {
      throw orderService.createOrderError('CANNOT_CANCEL_ORDER', `Tidak bisa membatalkan order dengan status ${order.status}.`);
    }

    const [items] = await conn.execute(
      `SELECT oi.product_variant_id, oi.quantity
       FROM order_items oi
       WHERE oi.order_id = ?
       FOR UPDATE`,
      [orderId]
    );

    const [result] = await conn.execute(
      `UPDATE orders o
       SET o.status = 'cancelled',
           o.order_status = 'cancelled',
           o.updated_at = NOW()
       WHERE o.id = ?`,
      [orderId]
    );

    for (const item of items) {
      if (item.product_variant_id && Number(item.quantity) > 0) {
        await stockService.increaseStock(conn, item.product_variant_id, Number(item.quantity));
      }
    }

    await conn.commit();
    return result.affectedRows || 0;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  ALLOWED_ORDER_STATUSES,
  ORDER_STATUS_MAP: orderService.MAIN_TO_ORDER_STATUS,
  listOrders,
  countOrders,
  getOrderDetail,
  getOrderItems,
  updateOrderStatus,
  updateTracking,
  cancelOrder,
};
