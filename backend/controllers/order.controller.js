const orderModel = require('../models/order.model');
const emailService = require('../services/email.service');

const SHIPPING_OPTIONS = Object.values(orderModel.SHIPPING_METHODS);
const PAYMENT_OPTIONS = Object.values(orderModel.PAYMENT_METHODS);

function toRupiah(value) {
  return Number(value || 0);
}

function normalizeVoucherCode(value) {
  return String(value || '').trim().toUpperCase();
}

async function renderCheckout(req, res, payload = {}) {
  const userId = req.session.user.id;
  const cart = await orderModel.getCartForCheckout(userId);

  if (cart.isEmpty) {
    req.flash('error', 'Keranjang kamu kosong. Tambahkan produk dulu sebelum checkout.');
    return res.redirect('/cart');
  }

  const addresses = await orderModel.listAddressesByUser(userId);
  const old = payload.old || req.session.checkoutOld || {};
  if (req.session.checkoutOld) {
    delete req.session.checkoutOld;
  }
  const selectedShipping = old.shipping_method || 'regular';
  const selectedPayment = old.payment_method || 'bank_transfer';

  const shippingCost = orderModel.SHIPPING_METHODS[selectedShipping]?.cost || 0;
  const totalAmount = cart.subtotal + shippingCost;

  return res.render('pages/checkout', {
    pageTitle: 'Checkout',
    cart,
    addresses,
    shippingOptions: SHIPPING_OPTIONS,
    paymentOptions: PAYMENT_OPTIONS,
    selectedShipping,
    selectedPayment,
    selectedAddressId: old.address_id ? Number(old.address_id) : null,
    shippingCost,
    totalAmount,
    formErrors: payload.formErrors || {},
    old,
  });
}

async function showCheckout(req, res) {
  return renderCheckout(req, res);
}

async function saveAddress(req, res) {
  const userId = req.session.user.id;

  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    res.status(422);
    return renderCheckout(req, res, {
      formErrors: req.formErrors,
      old: req.body,
    });
  }

  const payload = {
    recipient_name: req.body.recipient_name,
    phone: req.body.phone,
    province: req.body.province,
    city: req.body.city,
    district: req.body.district,
    postal_code: req.body.postal_code,
    full_address: req.body.full_address,
    is_default: ['1', 'true', 'on', true].includes(req.body.is_default),
  };

  await orderModel.createAddressByUser(userId, payload);
  req.flash('success', 'Alamat berhasil disimpan.');
  return res.redirect('/checkout');
}

async function placeOrder(req, res) {
  const userId = req.session.user.id;

  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    res.status(422);
    return renderCheckout(req, res, {
      formErrors: req.formErrors,
      old: req.body,
    });
  }

  const addressId = Number(req.body.address_id);
  const shippingMethod = String(req.body.shipping_method || '').trim();
  const paymentMethod = String(req.body.payment_method || '').trim();
  const notes = req.body.notes ? String(req.body.notes).trim() : null;
  const voucherCode = normalizeVoucherCode(req.body.voucher_code);

  const address = await orderModel.findAddressByIdAndUser(addressId, userId);
  if (!address) {
    res.status(422);
    return renderCheckout(req, res, {
      formErrors: { address_id: 'Alamat tidak valid atau bukan milik akun kamu.' },
      old: req.body,
    });
  }

  try {
    const order = await orderModel.placeOrderFromCart({
      userId,
      addressId,
      shippingMethod,
      paymentMethod,
      notes,
      voucherCode,
    });

    try {
      await emailService.sendOrderPlacedEmail({
        customer: req.session.user,
        order,
        items: order.items || [],
      });
    } catch (emailError) {
      console.error('[email] Failed to send order placed email:', emailError);
    }

    req.flash('success', 'Checkout berhasil! Pesanan kamu sudah dibuat.');
    return res.redirect(`/checkout/success/${encodeURIComponent(order.invoiceNumber)}`);
  } catch (error) {
    if (error.code === 'EMPTY_CART') {
      req.flash('error', 'Keranjang kosong. Tidak bisa membuat pesanan.');
      return res.redirect('/cart');
    }

    if (error.code === 'STOCK_CHANGED') {
      req.flash('error', 'Stok produk berubah. Silakan cek ulang keranjang kamu.');
      return res.redirect('/cart');
    }

    if (error.code === 'ADDRESS_NOT_FOUND') {
      res.status(422);
      return renderCheckout(req, res, {
        formErrors: { address_id: 'Alamat tidak ditemukan.' },
        old: req.body,
      });
    }

    if (error.code === 'VOUCHER_INVALID') {
      req.flash('error', error.message);
      req.session.checkoutOld = {
        ...req.body,
        voucher_code: voucherCode,
      };
      return res.redirect('/checkout');
    }

    throw error;
  }
}

async function showOrderSuccess(req, res) {
  const userId = req.session.user.id;
  const invoiceNumber = String(req.params.invoiceNumber || '').trim();
  const order = await orderModel.findOrderSuccessByInvoiceAndUser(invoiceNumber, userId);

  if (!order) {
    return res.status(404).render('pages/forbidden', {
      pageTitle: 'Order Not Found',
    });
  }

  return res.render('pages/order-success', {
    pageTitle: 'Order Success',
    order: {
      ...order,
      total_amount: toRupiah(order.total_amount),
      subtotal: toRupiah(order.subtotal),
      shipping_cost: toRupiah(order.shipping_cost),
      discount_amount: toRupiah(order.discount_amount),
    },
  });
}

module.exports = {
  showCheckout,
  saveAddress,
  placeOrder,
  showOrderSuccess,
};
