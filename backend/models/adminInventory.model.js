const db = require('../config/database');
const stockService = require('../services/stock.service');

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';
const ALLOWED_STOCK_FILTERS = new Set(['available', 'low', 'out']);
const ALLOWED_VARIANT_STATUSES = new Set(['active', 'inactive']);

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 15) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function buildInventoryFilters({ q = '', category = '', stock = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const search = String(q || '').trim();
  const categoryValue = String(category || '').trim();
  const stockFilter = String(stock || '').trim().toLowerCase();
  const statusFilter = String(status || '').trim().toLowerCase();

  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR pv.variant_sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (categoryValue) {
    if (/^\d+$/.test(categoryValue)) {
      where.push('c.id = ?');
      params.push(Number(categoryValue));
    } else {
      where.push('c.slug = ?');
      params.push(categoryValue);
    }
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

async function listInventory({ q = '', category = '', stock = '', status = '', page = 1, limit = 15 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildInventoryFilters({ q, category, stock, status });

  return db.query(
    `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.color_code, pv.stock,
            pv.price_override, pv.status AS variant_status, pv.variant_sku,
            pv.created_at AS variant_created_at, pv.updated_at AS variant_updated_at,
            p.name AS product_name, p.slug AS product_slug, p.sku AS product_sku,
            p.status AS product_status, p.price, p.discount_price,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
            c.status AS category_status,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     ${whereSql}
     GROUP BY pv.id, pv.product_id, pv.size, pv.color, pv.color_code, pv.stock,
              pv.price_override, pv.status, pv.variant_sku, pv.created_at, pv.updated_at,
              p.name, p.slug, p.sku, p.status, p.price, p.discount_price,
              c.id, c.name, c.slug, c.status
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

async function countInventory({ q = '', category = '', stock = '', status = '' } = {}) {
  const { whereSql, params } = buildInventoryFilters({ q, category, stock, status });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT pv.id) AS total
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getInventorySummary() {
  const rows = await db.query(
    `SELECT COUNT(pv.id) AS totalVariants,
            COALESCE(SUM(pv.stock), 0) AS totalStock,
            COUNT(CASE WHEN pv.stock > 0 AND pv.stock <= ? THEN 1 END) AS lowStockVariants,
            COUNT(CASE WHEN pv.stock = 0 THEN 1 END) AS outOfStockVariants
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id`,
    [LOW_STOCK_THRESHOLD]
  );

  const summary = rows[0] || {};
  return {
    totalVariants: Number(summary.totalVariants || 0),
    totalStock: Number(summary.totalStock || 0),
    lowStockVariants: Number(summary.lowStockVariants || 0),
    outOfStockVariants: Number(summary.outOfStockVariants || 0),
  };
}

async function findVariantById(variantId) {
  const rows = await db.query(
    `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.color_code, pv.stock,
            pv.price_override, pv.status AS variant_status, pv.variant_sku,
            p.name AS product_name, p.sku AS product_sku
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.id = ?
     LIMIT 1`,
    [variantId]
  );

  return rows[0] || null;
}

async function updateStock(variantId, stock) {
  return stockService.setStock(null, variantId, stock);
}

async function toggleVariantStatus(variantId) {
  const result = await db.query(
    `UPDATE product_variants pv
     SET pv.status = CASE WHEN pv.status = 'active' THEN 'inactive' ELSE 'active' END,
         pv.updated_at = NOW()
     WHERE pv.id = ?`,
    [variantId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  listInventory,
  countInventory,
  getInventorySummary,
  findVariantById,
  updateStock,
  toggleVariantStatus,
};
