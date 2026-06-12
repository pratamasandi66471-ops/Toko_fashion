const db = require('../config/database');

const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function normalizeRating(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function normalizeProductId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildReviewFilters({ q = '', rating = '', productId = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeRating = normalizeRating(rating);
  const safeProductId = normalizeProductId(productId);

  if (keyword) {
    where.push(`(
      u.name LIKE ?
      OR u.email LIKE ?
      OR p.name LIKE ?
      OR p.sku LIKE ?
      OR COALESCE(r.message, r.comment) LIKE ?
    )`);
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeRating) {
    where.push('r.rating = ?');
    params.push(safeRating);
  }

  if (safeProductId) {
    where.push('r.product_id = ?');
    params.push(safeProductId);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listReviews({ q = '', rating = '', productId = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildReviewFilters({ q, rating, productId });

  return db.query(
    `SELECT r.id, r.rating, r.created_at,
            COALESCE(r.message, r.comment) AS review_text,
            u.id AS customer_id, u.name AS customer_name, u.email AS customer_email,
            p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
            p.sku AS product_sku, p.status AS product_status,
            COALESCE(pi.image_url, ?) AS image_url,
            o.id AS order_id, o.order_code, o.invoice_number,
            o.status AS order_status, o.payment_status
     FROM reviews r
     LEFT JOIN users u ON u.id = COALESCE(r.customer_id, r.user_id)
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN orders o ON o.id = r.order_id
     LEFT JOIN product_images pi ON pi.id = (
       SELECT pi2.id
       FROM product_images pi2
       WHERE pi2.product_id = p.id
       ORDER BY pi2.is_primary DESC, pi2.id ASC
       LIMIT 1
     )
     ${whereSql}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [PRODUCT_IMAGE_FALLBACK, ...params, safeLimit, offset]
  );
}

async function countReviews({ q = '', rating = '', productId = '' } = {}) {
  const { whereSql, params } = buildReviewFilters({ q, rating, productId });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT r.id) AS total
     FROM reviews r
     LEFT JOIN users u ON u.id = COALESCE(r.customer_id, r.user_id)
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN orders o ON o.id = r.order_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getReviewDetail(reviewId) {
  const rows = await db.query(
    `SELECT r.id, r.customer_id AS review_customer_id, r.user_id AS review_user_id,
            r.product_id, r.order_id, r.rating, r.message, r.comment, r.created_at,
            COALESCE(r.message, r.comment) AS review_text,
            u.id AS customer_id, u.name AS customer_name, u.email AS customer_email,
            u.phone AS customer_phone, u.role AS customer_role, u.status AS customer_status,
            p.name AS product_name, p.slug AS product_slug, p.sku AS product_sku,
            p.status AS product_status,
            COALESCE(pi.image_url, ?) AS image_url,
            o.order_code, o.invoice_number, o.status AS order_status,
            o.order_status AS legacy_order_status, o.payment_status,
            o.total_amount, o.created_at AS order_created_at, o.ordered_at
     FROM reviews r
     LEFT JOIN users u ON u.id = COALESCE(r.customer_id, r.user_id)
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN orders o ON o.id = r.order_id
     LEFT JOIN product_images pi ON pi.id = (
       SELECT pi2.id
       FROM product_images pi2
       WHERE pi2.product_id = p.id
       ORDER BY pi2.is_primary DESC, pi2.id ASC
       LIMIT 1
     )
     WHERE r.id = ?
     LIMIT 1`,
    [PRODUCT_IMAGE_FALLBACK, reviewId]
  );

  return rows[0] || null;
}

async function deleteReview(reviewId) {
  const result = await db.query(
    `DELETE r
     FROM reviews r
     WHERE r.id = ?`,
    [reviewId]
  );

  return result.affectedRows || 0;
}

async function getProductsForFilter() {
  return db.query(
    `SELECT p.id, p.name, p.sku
     FROM products p
     ORDER BY p.name ASC, p.id ASC`
  );
}

module.exports = {
  PRODUCT_IMAGE_FALLBACK,
  listReviews,
  countReviews,
  getReviewDetail,
  deleteReview,
  getProductsForFilter,
};
