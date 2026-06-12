const db = require('../config/database');

function createStockError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function normalizeStock(value) {
  const stock = Number(value);
  return Number.isInteger(stock) && stock >= 0 ? stock : NaN;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : NaN;
}

function assertValidStock(value) {
  const stock = normalizeStock(value);
  if (!Number.isFinite(stock)) {
    throw createStockError('INVALID_STOCK', 'Stock harus berupa angka bulat minimal 0.');
  }

  return stock;
}

function assertValidQuantity(value) {
  const quantity = normalizeQuantity(value);
  if (!Number.isFinite(quantity)) {
    throw createStockError('INVALID_QUANTITY', 'Quantity harus berupa angka bulat minimal 1.');
  }

  return quantity;
}

function validateStockAvailability(variant, quantity) {
  const safeQuantity = assertValidQuantity(quantity);
  const stock = Number(variant?.stock || 0);
  const isActive = !variant?.status || variant.status === 'active' || variant.variant_status === 'active';

  if (!variant) {
    throw createStockError('VARIANT_NOT_FOUND', 'Variant produk tidak ditemukan.');
  }

  if (!isActive) {
    throw createStockError('VARIANT_INACTIVE', 'Variant produk tidak aktif.');
  }

  if (stock <= 0 || stock < safeQuantity) {
    throw createStockError('INSUFFICIENT_STOCK', 'Stok produk tidak mencukupi.', {
      stock,
      quantity: safeQuantity,
    });
  }

  return {
    valid: true,
    stock,
    quantity: safeQuantity,
    remainingStock: stock - safeQuantity,
  };
}

async function setStock(connection, variantId, stock) {
  const safeStock = assertValidStock(stock);
  const runner = connection || db.pool;
  const [result] = await runner.execute(
    `UPDATE product_variants pv
     SET pv.stock = ?,
         pv.updated_at = NOW()
     WHERE pv.id = ?`,
    [safeStock, variantId]
  );

  return result.affectedRows > 0;
}

async function decreaseStock(connection, variantId, quantity) {
  const safeQuantity = assertValidQuantity(quantity);
  const runner = connection || db.pool;
  const [result] = await runner.execute(
    `UPDATE product_variants pv
     SET pv.stock = pv.stock - ?,
         pv.updated_at = NOW()
     WHERE pv.id = ?
       AND pv.stock >= ?`,
    [safeQuantity, variantId, safeQuantity]
  );

  if (result.affectedRows < 1) {
    throw createStockError('INSUFFICIENT_STOCK', 'Stok produk tidak mencukupi.');
  }

  return true;
}

async function increaseStock(connection, variantId, quantity) {
  const safeQuantity = assertValidQuantity(quantity);
  const runner = connection || db.pool;
  const [result] = await runner.execute(
    `UPDATE product_variants pv
     SET pv.stock = pv.stock + ?,
         pv.updated_at = NOW()
     WHERE pv.id = ?`,
    [safeQuantity, variantId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  normalizeStock,
  normalizeQuantity,
  assertValidStock,
  assertValidQuantity,
  validateStockAvailability,
  setStock,
  decreaseStock,
  increaseStock,
};
