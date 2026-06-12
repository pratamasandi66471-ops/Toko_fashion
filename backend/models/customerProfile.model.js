const db = require('../config/database');

async function getProfileSummary(userId) {
  const rows = await db.query(
    `SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS total_spending,
        MAX(COALESCE(o.ordered_at, o.created_at)) AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.customer_id = u.id
     WHERE u.id = ?
       AND u.role = 'customer'
     GROUP BY u.id, u.name, u.email, u.phone, u.status, u.created_at
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function getProfileDetail(userId) {
  const rows = await db.query(
    `SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at
     FROM users u
     WHERE u.id = ?
       AND u.role = 'customer'
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function getDefaultAddress(userId) {
  const rows = await db.query(
    `SELECT
        a.id,
        a.user_id,
        a.recipient_name,
        a.phone,
        a.province,
        a.city,
        a.district,
        a.postal_code,
        a.full_address,
        a.is_default,
        a.created_at
     FROM addresses a
     WHERE a.user_id = ?
     ORDER BY a.is_default DESC, a.id DESC
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function getAddresses(userId) {
  return db.query(
    `SELECT
        a.id,
        a.user_id,
        a.recipient_name,
        a.phone,
        a.province,
        a.city,
        a.district,
        a.postal_code,
        a.full_address,
        a.is_default,
        a.created_at
     FROM addresses a
     WHERE a.user_id = ?
     ORDER BY a.is_default DESC, a.id DESC`,
    [userId]
  );
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 20);
}

async function getRecentOrders(userId, limit = 2) {
  const safeLimit = normalizeLimit(limit, 2);

  return db.query(
    `SELECT
        o.id,
        o.order_code,
        o.invoice_number,
        o.subtotal,
        o.shipping_cost,
        o.discount_amount,
        o.total_amount,
        o.status,
        o.order_status,
        o.payment_status,
        o.courier,
        o.tracking_number,
        o.ordered_at,
        o.created_at
     FROM orders o
     WHERE o.customer_id = ?
     ORDER BY COALESCE(o.ordered_at, o.created_at) DESC, o.id DESC
     LIMIT ?`,
    [userId, safeLimit]
  );
}

async function getOrders(userId, { page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit, 10);
  const offset = (safePage - 1) * safeLimit;

  return db.query(
    `SELECT
        o.id,
        o.order_code,
        o.invoice_number,
        o.subtotal,
        o.shipping_cost,
        o.discount_amount,
        o.total_amount,
        o.status,
        o.order_status,
        o.payment_status,
        o.courier,
        o.tracking_number,
        o.ordered_at,
        o.created_at
     FROM orders o
     WHERE o.customer_id = ?
     ORDER BY COALESCE(o.ordered_at, o.created_at) DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [userId, safeLimit, offset]
  );
}

async function countOrders(userId) {
  const rows = await db.query(
    `SELECT COUNT(o.id) AS total
     FROM orders o
     WHERE o.customer_id = ?`,
    [userId]
  );

  return Number(rows[0]?.total || 0);
}

async function findCustomerForPassword(userId) {
  const rows = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.password, u.role, u.status
     FROM users u
     WHERE u.id = ?
       AND u.role = 'customer'
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function updateProfile(userId, { name, phone }) {
  const result = await db.query(
    `UPDATE users u
     SET u.name = ?,
         u.phone = ?,
         u.updated_at = NOW()
     WHERE u.id = ?
       AND u.role = 'customer'`,
    [name, phone || null, userId]
  );

  return result.affectedRows > 0;
}

async function updatePassword(userId, passwordHash) {
  const result = await db.query(
    `UPDATE users u
     SET u.password = ?,
         u.updated_at = NOW()
     WHERE u.id = ?
       AND u.role = 'customer'`,
    [passwordHash, userId]
  );

  return result.affectedRows > 0;
}

async function findAddressByIdAndUser(addressId, userId) {
  const rows = await db.query(
    `SELECT
        a.id,
        a.user_id,
        a.recipient_name,
        a.phone,
        a.province,
        a.city,
        a.district,
        a.postal_code,
        a.full_address,
        a.is_default,
        a.created_at
     FROM addresses a
     WHERE a.id = ?
       AND a.user_id = ?
     LIMIT 1`,
    [addressId, userId]
  );

  return rows[0] || null;
}

async function createAddress(userId, payload) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.execute(
      `SELECT COUNT(*) AS total
       FROM addresses a
       WHERE a.user_id = ?`,
      [userId]
    );

    const shouldSetDefault = Boolean(payload.isDefault) || Number(existingRows[0]?.total || 0) === 0;

    if (shouldSetDefault) {
      await conn.execute(
        `UPDATE addresses a
         SET a.is_default = 0
         WHERE a.user_id = ?`,
        [userId]
      );
    }

    const [result] = await conn.execute(
      `INSERT INTO addresses
        (user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.recipientName,
        payload.phone,
        payload.province,
        payload.city,
        payload.district || null,
        payload.postalCode || null,
        payload.fullAddress,
        shouldSetDefault ? 1 : 0,
      ]
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

async function updateAddress(addressId, userId, payload) {
  const result = await db.query(
    `UPDATE addresses a
     SET a.recipient_name = ?,
         a.phone = ?,
         a.province = ?,
         a.city = ?,
         a.district = ?,
         a.postal_code = ?,
         a.full_address = ?
     WHERE a.id = ?
       AND a.user_id = ?`,
    [
      payload.recipientName,
      payload.phone,
      payload.province,
      payload.city,
      payload.district || null,
      payload.postalCode || null,
      payload.fullAddress,
      addressId,
      userId,
    ]
  );

  if (result.affectedRows > 0 && payload.isDefault) {
    await setDefaultAddress(addressId, userId);
  }

  return result.affectedRows > 0;
}

async function setDefaultAddress(addressId, userId) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [addressRows] = await conn.execute(
      `SELECT a.id
       FROM addresses a
       WHERE a.id = ?
         AND a.user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [addressId, userId]
    );

    if (!addressRows[0]) {
      await conn.rollback();
      return false;
    }

    await conn.execute(
      `UPDATE addresses a
       SET a.is_default = 0
       WHERE a.user_id = ?`,
      [userId]
    );

    await conn.execute(
      `UPDATE addresses a
       SET a.is_default = 1
       WHERE a.id = ?
         AND a.user_id = ?`,
      [addressId, userId]
    );

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function isAddressUsedByOrder(addressId, userId) {
  const rows = await db.query(
    `SELECT o.id
     FROM orders o
     WHERE o.address_id = ?
       AND o.customer_id = ?
     LIMIT 1`,
    [addressId, userId]
  );

  return rows.length > 0;
}

async function deleteAddress(addressId, userId) {
  const usedByOrder = await isAddressUsedByOrder(addressId, userId);
  if (usedByOrder) {
    const error = new Error('Alamat yang sudah dipakai order tidak bisa dihapus.');
    error.code = 'ADDRESS_USED_BY_ORDER';
    throw error;
  }

  const result = await db.query(
    `DELETE a
     FROM addresses a
     WHERE a.id = ?
       AND a.user_id = ?`,
    [addressId, userId]
  );

  if (result.affectedRows > 0) {
    const addresses = await getAddresses(userId);
    if (addresses.length > 0 && !addresses.some((address) => Number(address.is_default) === 1)) {
      await setDefaultAddress(addresses[0].id, userId);
    }
  }

  return result.affectedRows > 0;
}

module.exports = {
  getProfileSummary,
  getProfileDetail,
  getDefaultAddress,
  getAddresses,
  getRecentOrders,
  getOrders,
  countOrders,
  findCustomerForPassword,
  updateProfile,
  updatePassword,
  findAddressByIdAndUser,
  createAddress,
  updateAddress,
  setDefaultAddress,
  isAddressUsedByOrder,
  deleteAddress,
};
