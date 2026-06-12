const db = require('../config/database');

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function toNumber(value) {
  return Number(value || 0);
}

async function findByCode(code) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const rows = await db.query(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status, v.created_at
     FROM vouchers v
     WHERE v.code = ?
     LIMIT 1`,
    [normalizedCode]
  );

  return rows[0] || null;
}

function validateVoucherForCheckout(voucher, subtotal) {
  const cartSubtotal = Math.max(0, toNumber(subtotal));

  if (!voucher) {
    return { valid: false, message: 'Voucher tidak ditemukan.', discountAmount: 0 };
  }

  if (voucher.status !== 'active') {
    return { valid: false, message: 'Voucher sudah tidak aktif.', discountAmount: 0 };
  }

  const now = new Date();
  const startDate = voucher.start_date ? new Date(voucher.start_date) : null;
  const endDate = voucher.end_date ? new Date(voucher.end_date) : null;

  if (startDate && startDate > now) {
    return { valid: false, message: 'Voucher belum berlaku.', discountAmount: 0 };
  }

  if (endDate && endDate < now) {
    return { valid: false, message: 'Voucher sudah expired.', discountAmount: 0 };
  }

  if (cartSubtotal < toNumber(voucher.min_purchase)) {
    return { valid: false, message: 'Minimum pembelian belum terpenuhi.', discountAmount: 0 };
  }

  if (voucher.usage_limit !== null && Number(voucher.used_count || 0) >= Number(voucher.usage_limit)) {
    return { valid: false, message: 'Voucher sudah mencapai batas penggunaan.', discountAmount: 0 };
  }

  const type = String(voucher.type || '').trim().toLowerCase();
  const value = toNumber(voucher.value);

  if (!['fixed', 'percentage'].includes(type) || value <= 0) {
    return { valid: false, message: 'Voucher tidak valid.', discountAmount: 0 };
  }

  if (type === 'percentage' && value > 100) {
    return { valid: false, message: 'Voucher tidak valid.', discountAmount: 0 };
  }

  let discountAmount = type === 'fixed'
    ? value
    : (cartSubtotal * value) / 100;

  if (type === 'percentage' && voucher.max_discount !== null) {
    discountAmount = Math.min(discountAmount, toNumber(voucher.max_discount));
  }

  discountAmount = Math.max(0, Math.min(discountAmount, cartSubtotal));

  return {
    valid: true,
    message: 'Voucher valid.',
    discountAmount,
  };
}

async function incrementUsedCount(voucherId, connection) {
  const runner = connection || db.pool;
  const [result] = await runner.execute(
    `UPDATE vouchers
     SET used_count = used_count + 1
     WHERE id = ?`,
    [voucherId]
  );

  return result.affectedRows || 0;
}

module.exports = {
  normalizeCode,
  findByCode,
  validateVoucherForCheckout,
  incrementUsedCount,
};
