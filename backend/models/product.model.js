const fs = require('fs');
const path = require('path');

const db = require('../config/database');

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';
const PUBLIC_ROOT = path.join(__dirname, '..', '..', 'public');

function normalizeLimit(value, fallback = 12) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function buildProductFilters(filters = {}) {
  const where = [];
  const params = [];

  if (filters.search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.categoryId) {
    where.push('p.category_id = ?');
    params.push(filters.categoryId);
  }

  if (['draft', 'active', 'inactive'].includes(filters.status)) {
    where.push('p.status = ?');
    params.push(filters.status);
  }

  return { where, params };
}

async function countProducts(filters = {}) {
  const { where, params } = buildProductFilters(filters);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lowStockHaving = filters.lowStock ? `HAVING total_stock > 0 AND total_stock <= ?` : '';
  const lowStockParams = filters.lowStock ? [LOW_STOCK_THRESHOLD] : [];

  const rows = await db.query(
    `SELECT COUNT(*) AS value
     FROM (
       SELECT p.id, COALESCE(SUM(pv.stock), 0) AS total_stock
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       ${whereSql}
       GROUP BY p.id
       ${lowStockHaving}
     ) t`,
    [...params, ...lowStockParams]
  );

  return Number(rows[0]?.value || 0);
}

async function listProducts(filters = {}) {
  const page = normalizePage(filters.page);
  const limit = normalizeLimit(filters.limit);
  const offset = (page - 1) * limit;
  const { where, params } = buildProductFilters(filters);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lowStockHaving = filters.lowStock ? `HAVING total_stock > 0 AND total_stock <= ?` : '';
  const lowStockParams = filters.lowStock ? [LOW_STOCK_THRESHOLD] : [];

  const rows = await db.query(
    `SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price, p.discount_price,
            p.sku, p.status, p.is_featured, p.created_at, p.updated_at,
            c.name AS category_name,
            COALESCE(SUM(pv.stock), 0) AS total_stock,
            COUNT(DISTINCT pv.id) AS variant_count,
            COALESCE(MAX(CASE WHEN pi.is_primary = 1 THEN pi.image_url END), MAX(pi.image_url), ?) AS image_url
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     ${whereSql}
     GROUP BY p.id, p.category_id, p.name, p.slug, p.description, p.price, p.discount_price,
              p.sku, p.status, p.is_featured, p.created_at, p.updated_at, c.name
     ${lowStockHaving}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [PRODUCT_IMAGE_FALLBACK, ...params, ...lowStockParams, limit, offset]
  );

  const total = await countProducts(filters);
  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function findById(id) {
  const rows = await db.query(
    `SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price, p.discount_price,
            p.sku, p.status, p.is_featured, p.created_by, p.created_at, p.updated_at,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function listVariants(productId) {
  return db.query(
    `SELECT id, product_id, size, color, color_code, stock, price_override, status, variant_sku, created_at, updated_at
     FROM product_variants
     WHERE product_id = ?
     ORDER BY FIELD(status, 'active', 'inactive'), size ASC, color ASC`,
    [productId]
  );
}

async function getProductImages(productId) {
  return db.query(
    `SELECT id, product_id, image_url, is_primary, created_at
     FROM product_images
     WHERE product_id = ?
     ORDER BY is_primary DESC, id ASC`,
    [productId]
  );
}

async function getProductEditorData(id) {
  const product = await findById(id);
  if (!product) return null;

  const [variants, images] = await Promise.all([
    listVariants(id),
    getProductImages(id),
  ]);

  return { product, variants, images };
}

async function isSkuTaken(sku, excludeId = null) {
  const params = [sku];
  let sql = 'SELECT id FROM products WHERE sku = ?';
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const rows = await db.query(sql, params);
  return rows.length > 0;
}

async function isSlugTaken(slug, excludeId = null) {
  const params = [slug];
  let sql = 'SELECT id FROM products WHERE slug = ?';
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const rows = await db.query(sql, params);
  return rows.length > 0;
}

async function isVariantSkuTaken(variantSku, excludeId = null) {
  const params = [variantSku];
  let sql = 'SELECT id FROM product_variants WHERE variant_sku = ?';
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const rows = await db.query(sql, params);
  return rows.length > 0;
}

async function createProduct(payload, variants = []) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [productResult] = await conn.execute(
      `INSERT INTO products
        (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.categoryId,
        payload.name,
        payload.slug,
        payload.description || null,
        payload.price,
        payload.discountPrice,
        payload.sku,
        payload.status,
        payload.isFeatured ? 1 : 0,
        payload.createdBy || null,
      ]
    );

    const productId = productResult.insertId;

    for (const variant of variants) {
      await conn.execute(
        `INSERT INTO product_variants
          (product_id, size, color, color_code, stock, price_override, status, variant_sku)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          variant.size,
          variant.color,
          variant.colorCode || null,
          variant.stock,
          variant.priceOverride,
          variant.status,
          variant.variantSku,
        ]
      );
    }

    await conn.commit();
    return productId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateProduct(id, payload) {
  const result = await db.query(
    `UPDATE products
     SET category_id = ?, name = ?, slug = ?, description = ?, price = ?, discount_price = ?,
         sku = ?, status = ?, is_featured = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      payload.categoryId,
      payload.name,
      payload.slug,
      payload.description || null,
      payload.price,
      payload.discountPrice,
      payload.sku,
      payload.status,
      payload.isFeatured ? 1 : 0,
      id,
    ]
  );

  return result.affectedRows > 0;
}

async function toggleStatus(id) {
  const result = await db.query(
    `UPDATE products
     SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END,
         updated_at = NOW()
     WHERE id = ?`,
    [id]
  );

  return result.affectedRows > 0;
}

async function addVariant(productId, variant) {
  const result = await db.query(
    `INSERT INTO product_variants
      (product_id, size, color, color_code, stock, price_override, status, variant_sku)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      variant.size,
      variant.color,
      variant.colorCode || null,
      variant.stock,
      variant.priceOverride,
      variant.status,
      variant.variantSku,
    ]
  );

  return result.insertId;
}

async function updateVariant(variantId, variant) {
  const result = await db.query(
    `UPDATE product_variants
     SET size = ?, color = ?, color_code = ?, stock = ?, price_override = ?, status = ?,
         variant_sku = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      variant.size,
      variant.color,
      variant.colorCode || null,
      variant.stock,
      variant.priceOverride,
      variant.status,
      variant.variantSku,
      variantId,
    ]
  );

  return result.affectedRows > 0;
}

async function findVariantById(variantId) {
  const rows = await db.query(
    `SELECT id, product_id, size, color, color_code, stock, price_override, status, variant_sku
     FROM product_variants
     WHERE id = ?
     LIMIT 1`,
    [variantId]
  );

  return rows[0] || null;
}

async function deleteVariant(variantId) {
  const result = await db.query(
    `DELETE FROM product_variants
     WHERE id = ?`,
    [variantId]
  );

  return result.affectedRows > 0;
}

async function findImageById(imageId) {
  const rows = await db.query(
    `SELECT id, product_id, image_url, is_primary
     FROM product_images
     WHERE id = ?
     LIMIT 1`,
    [imageId]
  );

  return rows[0] || null;
}

async function addProductImage({ productId, imageUrl, isPrimary = false }) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.execute(
      `SELECT COUNT(*) AS total
       FROM product_images
       WHERE product_id = ?`,
      [productId]
    );

    const shouldSetPrimary = Boolean(isPrimary) || Number(existingRows[0]?.total || 0) === 0;

    if (shouldSetPrimary) {
      await conn.execute(
        `UPDATE product_images
         SET is_primary = 0
         WHERE product_id = ?`,
        [productId]
      );
    }

    const [result] = await conn.execute(
      `INSERT INTO product_images (product_id, image_url, is_primary)
       VALUES (?, ?, ?)`,
      [productId, imageUrl, shouldSetPrimary ? 1 : 0]
    );

    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function isManagedUploadPath(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/products/');
}

function removeManagedUploadFile(imageUrl) {
  if (!isManagedUploadPath(imageUrl)) return;

  const absolutePath = path.resolve(PUBLIC_ROOT, imageUrl.replace(/^\/+/, ''));
  const uploadRoot = path.resolve(PUBLIC_ROOT, 'uploads', 'products');

  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return;

  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (_error) {
    // File cleanup is best-effort; database state is the source of truth.
  }
}

async function deleteProductImage(imageId) {
  const image = await findImageById(imageId);
  if (!image) return false;

  const result = await db.query(
    `DELETE FROM product_images
     WHERE id = ?`,
    [imageId]
  );

  const remaining = await getProductImages(image.product_id);
  if (remaining.length > 0 && !remaining.some((item) => Number(item.is_primary) === 1)) {
    await setPrimaryImage(remaining[0].id);
  }

  if (result.affectedRows > 0) {
    removeManagedUploadFile(image.image_url);
  }

  return result.affectedRows > 0;
}

async function setPrimaryImage(imageId) {
  const image = await findImageById(imageId);
  if (!image) return false;

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [image.product_id]);
    await conn.execute('UPDATE product_images SET is_primary = 1 WHERE id = ?', [imageId]);
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  listProducts,
  findById,
  getProductEditorData,
  listVariants,
  getProductImages,
  isSkuTaken,
  isSlugTaken,
  isVariantSkuTaken,
  createProduct,
  updateProduct,
  toggleStatus,
  addVariant,
  updateVariant,
  findVariantById,
  deleteVariant,
  addProductImage,
  findImageById,
  deleteProductImage,
  setPrimaryImage,
};
