const db = require('../config/database');
const voucherModel = require('./voucher.model');
const shippingModel = require('./shipping.model');
const orderService = require('../services/order.service');
const stockService = require('../services/stock.service');
let ordersColumnCache = null;
let ordersColumnLoading = null;

async function getOrdersColumns() {
  if (ordersColumnCache) {
    return ordersColumnCache;
  }

  if (ordersColumnLoading) {
    return ordersColumnLoading;
  }

  ordersColumnLoading = (async () => {
    const rows = await db.query('SHOW COLUMNS FROM orders');
    ordersColumnCache = new Set(rows.map((row) => row.Field));
    return ordersColumnCache;
  })().finally(() => {
    ordersColumnLoading = null;
  });

  return ordersColumnLoading;
}

const SHIPPING_METHODS = shippingModel.DEFAULT_SHIPPING_METHODS.reduce((methods, method) => {
  methods[method.key] = method;
  return methods;
}, {});

const PAYMENT_METHODS = {
  bank_transfer: { key: 'bank_transfer', label: 'Bank Transfer', initialStatus: 'pending_verification' },
  cod: { key: 'cod', label: 'Cash On Delivery', initialStatus: 'unpaid' },
};

function normalizePrice(price, discountPrice) {
  const discount = Number(discountPrice || 0);
  const base = Number(price || 0);

  if (discount > 0 && discount < base) {
    return discount;
  }

  return base;
}

async function listAddressesByUser(userId) {
  return db.query(
    `SELECT id, user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default, created_at
     FROM addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
}

async function listShippingOptions() {
  return shippingModel.listActiveShippingMethods();
}

async function findAddressByIdAndUser(addressId, userId, conn = null) {
  const runner = conn || db.pool;
  const [rows] = await runner.execute(
    `SELECT id, user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default
     FROM addresses
     WHERE id = ?
       AND user_id = ?
     LIMIT 1`,
    [addressId, userId]
  );

  return rows[0] || null;
}

async function createAddressByUser(userId, payload) {
  const {
    recipient_name: recipientName,
    phone,
    province,
    city,
    district,
    postal_code: postalCode,
    full_address: fullAddress,
    is_default: isDefault,
  } = payload;

  if (isDefault) {
    await db.query(
      `UPDATE addresses
       SET is_default = 0
       WHERE user_id = ?`,
      [userId]
    );
  }

  const result = await db.query(
    `INSERT INTO addresses
      (user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, recipientName, phone, province, city, district || null, postalCode || null, fullAddress, isDefault ? 1 : 0]
  );

  return result.insertId;
}

async function getCartForCheckout(userId) {
  const rows = await db.query(
    `SELECT c.id AS cart_item_id,
            c.user_id,
            c.quantity,
            pv.id AS product_variant_id,
            pv.product_id,
            pv.size,
            pv.color,
            pv.variant_sku,
            pv.stock,
            p.name AS product_name,
            p.slug AS product_slug,
            p.sku AS product_sku,
            p.status AS product_status,
            p.price,
            p.discount_price
     FROM carts c
     INNER JOIN product_variants pv ON pv.id = c.product_variant_id
     INNER JOIN products p ON p.id = pv.product_id
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC`,
    [userId]
  );

  const items = rows.map((row) => {
    const unitPrice = normalizePrice(row.price, row.discount_price);
    const quantity = Number(row.quantity || 0);

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
      quantity,
      stock: Number(row.stock || 0),
      unitPrice,
      subtotal: unitPrice * quantity,
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

async function findVoucherByCodeForUpdate(code, conn) {
  const normalizedCode = voucherModel.normalizeCode(code);
  if (!normalizedCode) return null;

  const [rows] = await conn.execute(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status, v.created_at
     FROM vouchers v
     WHERE v.code = ?
     LIMIT 1
     FOR UPDATE`,
    [normalizedCode]
  );

  return rows[0] || null;
}

async function placeOrderFromCart({ userId, addressId, shippingMethod, paymentMethod, notes, voucherCode = '' }) {
  const payment = PAYMENT_METHODS[paymentMethod];

  if (!payment) {
    const error = new Error('Metode pengiriman atau pembayaran tidak valid.');
    error.code = 'INVALID_CHECKOUT_OPTION';
    throw error;
  }

  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();

    const shipping = await shippingModel.findByCode(shippingMethod, conn, {
      activeOnly: true,
      forUpdate: true,
    });

    if (!shipping) {
      const error = new Error('Metode pengiriman tidak valid atau sedang tidak aktif.');
      error.code = 'INVALID_CHECKOUT_OPTION';
      throw error;
    }

    const address = await findAddressByIdAndUser(addressId, userId, conn);
    if (!address) {
      const error = new Error('Alamat tidak ditemukan.');
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    const [cartRows] = await conn.execute(
      `SELECT c.id AS cart_item_id,
              c.quantity,
              pv.id AS product_variant_id,
              pv.product_id,
              pv.size,
              pv.color,
              pv.variant_sku,
              pv.stock,
              p.name AS product_name,
              p.price,
              p.discount_price,
              p.status AS product_status
       FROM carts c
       INNER JOIN product_variants pv ON pv.id = c.product_variant_id
       INNER JOIN products p ON p.id = pv.product_id
       WHERE c.user_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (cartRows.length === 0) {
      const error = new Error('Keranjang belanja kamu kosong.');
      error.code = 'EMPTY_CART';
      throw error;
    }

    const invalidItems = [];
    const orderItems = cartRows.map((row) => {
      const stock = Number(row.stock || 0);
      const quantity = Number(row.quantity || 0);
      const isActive = row.product_status === 'active';

      if (!isActive || stock < quantity || stock <= 0) {
        invalidItems.push({
          name: row.product_name,
          size: row.size,
          color: row.color,
          stock,
          quantity,
        });
      }

      const unitPrice = normalizePrice(row.price, row.discount_price);
      const subtotal = unitPrice * quantity;

      return {
        productId: Number(row.product_id),
        productVariantId: Number(row.product_variant_id),
        productName: row.product_name,
        size: row.size,
        color: row.color,
        variantSku: row.variant_sku,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    if (invalidItems.length > 0) {
      const error = new Error('Sebagian item melebihi stok atau tidak aktif.');
      error.code = 'STOCK_CHANGED';
      error.details = invalidItems;
      throw error;
    }

    const subtotal = orderItems.reduce((acc, item) => acc + item.subtotal, 0);
    const shippingCost = Number(shipping.cost);
    const normalizedVoucherCode = voucherModel.normalizeCode(voucherCode);
    let appliedVoucher = null;
    let discountAmount = 0;

    if (normalizedVoucherCode) {
      appliedVoucher = await findVoucherByCodeForUpdate(normalizedVoucherCode, conn);
      const voucherValidation = voucherModel.validateVoucherForCheckout(appliedVoucher, subtotal);

      if (!voucherValidation.valid) {
        const error = new Error(voucherValidation.message);
        error.code = 'VOUCHER_INVALID';
        throw error;
      }

      discountAmount = voucherValidation.discountAmount;
    }

    const totalAmount = Math.max(0, subtotal + shippingCost - discountAmount);

    const orderCode = await orderService.generateUniqueOrderCode(conn);
    const invoiceNumber = await orderService.generateUniqueInvoiceNumber(conn);
    const paymentStatus = payment.initialStatus;

    const orderColumns = await getOrdersColumns();
    const includeLegacyUserId = orderColumns.has('user_id');

    const insertColumns = [
      ...(includeLegacyUserId ? ['user_id'] : []),
      'customer_id',
      'address_id',
      'order_code',
      'invoice_number',
      'subtotal',
      'shipping_cost',
      'discount_amount',
      'total_amount',
      'status',
      'order_status',
      'payment_status',
      'courier',
      'notes',
      'ordered_at',
    ];

    const insertValues = [
      ...(includeLegacyUserId ? [userId] : []),
      userId,
      address.id,
      orderCode,
      invoiceNumber,
      subtotal,
      shippingCost,
      discountAmount,
      totalAmount,
      'pending',
      'pending',
      paymentStatus,
      shipping.key,
      notes || null,
      new Date(),
    ];

    const placeholders = insertColumns.map(() => '?').join(', ');
    const [orderInsert] = await conn.execute(
      `INSERT INTO orders (${insertColumns.join(', ')})
       VALUES (${placeholders})`,
      insertValues
    );

    const orderId = orderInsert.insertId;

    for (const item of orderItems) {
      await conn.execute(
        `INSERT INTO order_items
          (order_id, product_id, product_variant_id, product_name, size, color, variant_sku, price, quantity, total, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.productVariantId,
          item.productName,
          item.size,
          item.color,
          item.variantSku || null,
          item.unitPrice,
          item.quantity,
          item.subtotal,
          item.unitPrice,
          item.subtotal,
        ]
      );

      try {
        await stockService.decreaseStock(conn, item.productVariantId, item.quantity);
      } catch (stockError) {
        if (stockError.code === 'INSUFFICIENT_STOCK') {
          const error = new Error('Sebagian item melebihi stok atau tidak aktif.');
          error.code = 'STOCK_CHANGED';
          error.details = [item];
          throw error;
        }

        throw stockError;
      }
    }

    await conn.execute(
      `INSERT INTO payments
        (order_id, method, payment_method, amount, status)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, payment.key, payment.key, totalAmount, payment.initialStatus]
    );

    await conn.execute(
      `DELETE FROM carts
       WHERE user_id = ?`,
      [userId]
    );

    if (appliedVoucher) {
      await voucherModel.incrementUsedCount(appliedVoucher.id, conn);
    }

    await conn.commit();

    return {
      orderId,
      orderCode,
      invoiceNumber,
      subtotal,
      shippingCost,
      discountAmount,
      totalAmount,
      voucherCode: appliedVoucher ? appliedVoucher.code : null,
      paymentMethod: payment.key,
      paymentStatus: payment.initialStatus,
      items: orderItems,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function findOrderSuccessByInvoiceAndUser(invoiceNumber, userId) {
  const rows = await db.query(
    `SELECT o.id, o.invoice_number, o.order_code, o.total_amount, o.subtotal, o.shipping_cost, o.discount_amount,
            o.status, o.order_status, o.payment_status, o.courier, o.ordered_at,
            p.method AS payment_method, p.status AS payment_record_status
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.invoice_number = ?
       AND o.customer_id = ?
     LIMIT 1`,
    [invoiceNumber, userId]
  );

  return rows[0] || null;
}

module.exports = {
  SHIPPING_METHODS,
  PAYMENT_METHODS,
  listShippingOptions,
  listAddressesByUser,
  findAddressByIdAndUser,
  createAddressByUser,
  getCartForCheckout,
  placeOrderFromCart,
  findOrderSuccessByInvoiceAndUser,
};
