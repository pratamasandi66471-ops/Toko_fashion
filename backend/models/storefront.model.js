const db = require('../config/database');

const ALLOWED_SORTS = new Set(['latest', 'price_low', 'price_high', 'name']);
const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 12;
}

function buildShopWhere({ q = '', category = '' } = {}) {
  const where = ['p.status = ?'];
  const params = ['active'];

  if (q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }

  return {
    whereSql: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

function getOrderBy(sort) {
  if (sort === 'price_low') return 'effective_price ASC, p.name ASC';
  if (sort === 'price_high') return 'effective_price DESC, p.name ASC';
  if (sort === 'name') return 'p.name ASC';
  return 'p.created_at DESC, p.id DESC';
}

async function getShopProducts({ q = '', category = '', sort = 'latest', page = 1, limit = 12 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const safeSort = ALLOWED_SORTS.has(sort) ? sort : 'latest';
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildShopWhere({ q, category });

  return db.query(
    `SELECT p.id, p.name, p.slug, p.description, p.price, p.discount_price, p.sku,
            p.is_featured, p.created_at,
            c.name AS category_name, c.slug AS category_slug,
            COALESCE(SUM(CASE WHEN pv.status = 'active' THEN pv.stock ELSE 0 END), 0) AS total_stock,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url,
            CASE
              WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 AND p.discount_price < p.price THEN p.discount_price
              ELSE p.price
            END AS effective_price
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     ${whereSql}
     GROUP BY p.id, p.name, p.slug, p.description, p.price, p.discount_price,
              p.sku, p.is_featured, p.created_at, c.name, c.slug
     ORDER BY ${getOrderBy(safeSort)}
     LIMIT ? OFFSET ?`,
    [PRODUCT_IMAGE_FALLBACK, ...params, safeLimit, offset]
  );
}

async function countShopProducts({ q = '', category = '' } = {}) {
  const { whereSql, params } = buildShopWhere({ q, category });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getActiveCategories() {
  return db.query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
     WHERE c.status = 'active'
     GROUP BY c.id, c.name, c.slug
     ORDER BY c.name ASC`
  );
}

async function getHomeCategories(limit = 8) {
  const safeLimit = normalizeLimit(limit);

  return db.query(
    `SELECT c.id, c.name, c.slug, c.description, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
     WHERE c.status = 'active'
     GROUP BY c.id, c.name, c.slug, c.description
     ORDER BY c.name ASC
     LIMIT ?`,
    [safeLimit]
  );
}

async function getHomeProducts({ featuredOnly = false, limit = 8 } = {}) {
  const safeLimit = normalizeLimit(limit);
  const featuredSql = featuredOnly ? 'AND p.is_featured = 1' : '';

  return db.query(
    `SELECT p.id, p.name, p.slug, p.price, p.discount_price, p.sku,
            p.is_featured, p.created_at,
            c.name AS category_name, c.slug AS category_slug,
            COALESCE(SUM(CASE WHEN pv.status = 'active' THEN pv.stock ELSE 0 END), 0) AS total_stock,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE p.status = 'active'
       ${featuredSql}
     GROUP BY p.id, p.name, p.slug, p.price, p.discount_price, p.sku,
              p.is_featured, p.created_at, c.name, c.slug
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    [PRODUCT_IMAGE_FALLBACK, safeLimit]
  );
}

async function getNewArrivals(limit = 8) {
  return getHomeProducts({ limit });
}

async function getFeaturedProducts(limit = 8) {
  return getHomeProducts({ featuredOnly: true, limit });
}

async function getProductBySlug(slug) {
  const rows = await db.query(
    `SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price,
            p.discount_price, p.sku, p.is_featured,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ?
       AND p.status = 'active'
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function getProductImages(productId) {
  return db.query(
    `SELECT id, image_url, is_primary
     FROM product_images
     WHERE product_id = ?
     ORDER BY is_primary DESC, id ASC`,
    [productId]
  );
}

async function getProductVariants(productId) {
  return db.query(
    `SELECT id, product_id, size, color, color_code, stock, price_override, status, variant_sku
     FROM product_variants
     WHERE product_id = ?
       AND status = 'active'
     ORDER BY color ASC, size ASC`,
    [productId]
  );
}

async function getRelatedProducts(categoryId, currentProductId, limit = 4) {
  const safeLimit = normalizeLimit(limit);

  return db.query(
    `SELECT p.id, p.name, p.slug, p.price, p.discount_price,
            COALESCE(SUM(CASE WHEN pv.status = 'active' THEN pv.stock ELSE 0 END), 0) AS total_stock,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM products p
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE p.category_id = ?
       AND p.id <> ?
       AND p.status = 'active'
     GROUP BY p.id, p.name, p.slug, p.price, p.discount_price
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    [PRODUCT_IMAGE_FALLBACK, categoryId, currentProductId, safeLimit]
  );
}

module.exports = {
  PRODUCT_IMAGE_FALLBACK,
  getShopProducts,
  countShopProducts,
  getActiveCategories,
  getHomeCategories,
  getNewArrivals,
  getFeaturedProducts,
  getProductBySlug,
  getProductImages,
  getProductVariants,
  getRelatedProducts,
};
