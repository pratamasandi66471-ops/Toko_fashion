const db = require('../config/database');

function normalizePrice(price, discountPrice) {
  const discount = Number(discountPrice || 0);
  const base = Number(price || 0);

  if (discount > 0 && discount < base) {
    return discount;
  }

  return base;
}

async function getCartCountByUser(userId) {
  const rows = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS value
     FROM carts
     WHERE user_id = ?`,
    [userId]
  );

  return Number(rows[0]?.value || 0);
}

async function findVariantById(variantId) {
  const rows = await db.query(
    `SELECT pv.id AS product_variant_id,
            pv.product_id,
            pv.size,
            pv.color,
            pv.stock,
            pv.variant_sku,
            pv.status AS variant_status,
            p.name AS product_name,
            p.slug AS product_slug,
            p.sku AS product_sku,
            p.price,
            p.discount_price,
            p.status AS product_status
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.id = ?
     LIMIT 1`,
    [variantId]
  );

  return rows[0] || null;
}

async function findVariantByAttributes(productId, size, color) {
  const rows = await db.query(
    `SELECT pv.id AS product_variant_id,
            pv.product_id,
            pv.size,
            pv.color,
            pv.stock,
            pv.variant_sku,
            pv.status AS variant_status,
            p.name AS product_name,
            p.slug AS product_slug,
            p.sku AS product_sku,
            p.price,
            p.discount_price,
            p.status AS product_status
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.product_id = ?
       AND pv.size = ?
       AND pv.color = ?
     LIMIT 1`,
    [productId, size, color]
  );

  return rows[0] || null;
}

async function findCartItemByIdAndUser(itemId, userId) {
  const rows = await db.query(
    `SELECT id, user_id, product_variant_id, quantity
     FROM carts
     WHERE id = ?
       AND user_id = ?
     LIMIT 1`,
    [itemId, userId]
  );

  return rows[0] || null;
}

async function findCartItemByVariantAndUser(variantId, userId) {
  const rows = await db.query(
    `SELECT id, user_id, product_variant_id, quantity
     FROM carts
     WHERE user_id = ?
       AND product_variant_id = ?
     LIMIT 1`,
    [userId, variantId]
  );

  return rows[0] || null;
}

async function upsertCartItem(userId, variantId, quantityToAdd, maxStock) {
  const existing = await findCartItemByVariantAndUser(variantId, userId);

  if (!existing) {
    const quantity = Math.min(quantityToAdd, maxStock);
    const result = await db.query(
      `INSERT INTO carts (user_id, product_variant_id, quantity)
       VALUES (?, ?, ?)`,
      [userId, variantId, quantity]
    );

    return {
      itemId: result.insertId,
      quantity,
      clamped: quantity < quantityToAdd,
    };
  }

  const proposed = Number(existing.quantity || 0) + quantityToAdd;
  const nextQty = Math.min(proposed, maxStock);

  await db.query(
    `UPDATE carts
     SET quantity = ?, updated_at = NOW()
     WHERE id = ?
       AND user_id = ?`,
    [nextQty, existing.id, userId]
  );

  return {
    itemId: existing.id,
    quantity: nextQty,
    clamped: nextQty < proposed,
  };
}

async function updateItemQuantityByUser(itemId, userId, quantity) {
  const result = await db.query(
    `UPDATE carts
     SET quantity = ?, updated_at = NOW()
     WHERE id = ?
       AND user_id = ?`,
    [quantity, itemId, userId]
  );

  return result.affectedRows > 0;
}

async function removeItemByUser(itemId, userId) {
  const result = await db.query(
    `DELETE FROM carts
     WHERE id = ?
       AND user_id = ?`,
    [itemId, userId]
  );

  return result.affectedRows > 0;
}

async function listCartItemsByUser(userId) {
  return db.query(
    `SELECT c.id AS cart_item_id,
            c.user_id,
            c.product_variant_id,
            c.quantity,
            pv.size,
            pv.color,
            pv.stock,
            pv.variant_sku,
            p.id AS product_id,
            p.name AS product_name,
            p.slug AS product_slug,
            p.sku AS product_sku,
            p.status AS product_status,
            p.price,
            p.discount_price,
            COALESCE(pi.image_url, '/images/placeholder-product.jpg') AS image_url
     FROM carts c
     INNER JOIN product_variants pv ON pv.id = c.product_variant_id
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC`,
    [userId]
  );
}

async function getCartSummaryByUser(userId) {
  const rows = await listCartItemsByUser(userId);
  const items = rows.map((row) => {
    const unitPrice = normalizePrice(row.price, row.discount_price);
    const quantity = Number(row.quantity || 0);
    const subtotal = unitPrice * quantity;

    return {
      cartItemId: Number(row.cart_item_id),
      productId: Number(row.product_id),
      productVariantId: Number(row.product_variant_id),
      productName: row.product_name,
      productSlug: row.product_slug,
      productSku: row.product_sku,
      variantSku: row.variant_sku,
      size: row.size,
      color: row.color,
      stock: Number(row.stock || 0),
      imageUrl: row.image_url,
      unitPrice,
      quantity,
      subtotal,
      isProductActive: row.product_status === 'active',
    };
  });

  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return {
    items,
    subtotal,
    itemCount,
    isEmpty: items.length === 0,
  };
}

module.exports = {
  getCartCountByUser,
  findVariantById,
  findVariantByAttributes,
  findCartItemByIdAndUser,
  upsertCartItem,
  updateItemQuantityByUser,
  removeItemByUser,
  getCartSummaryByUser,
};
