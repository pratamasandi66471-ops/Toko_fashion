const cartModel = require('../models/cart.model');

function redirectBack(req, res, fallback = '/cart') {
  const target = req.get('referer') || fallback;
  return res.redirect(target);
}

function parseQuantity(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

async function resolveVariantFromRequest(body) {
  if (body.product_variant_id) {
    return cartModel.findVariantById(Number(body.product_variant_id));
  }

  return null;
}

async function showCart(req, res) {
  const userId = req.session.user.id;
  const cart = await cartModel.getCartSummaryByUser(userId);

  return res.render('pages/cart', {
    pageTitle: 'Keranjang Belanja',
    cart,
    old: {},
    formErrors: {},
  });
}

async function addItem(req, res) {
  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    req.flash('error', req.formErrors.product_variant_id || req.formErrors.quantity || req.formErrors._error || 'Input keranjang tidak valid.');
    return redirectBack(req, res, '/shop');
  }

  const userId = req.session.user.id;
  const quantity = parseQuantity(req.body.quantity, 1);
  const variant = await resolveVariantFromRequest(req.body);

  if (!variant) {
    req.flash('error', 'Varian produk tidak ditemukan.');
    return redirectBack(req, res, '/shop');
  }

  if (variant.product_status !== 'active') {
    req.flash('error', 'Produk saat ini tidak tersedia.');
    return redirectBack(req, res, '/shop');
  }

  if (variant.variant_status && variant.variant_status !== 'active') {
    req.flash('error', 'Varian produk saat ini tidak tersedia.');
    return redirectBack(req, res, '/shop');
  }

  const stock = Number(variant.stock || 0);
  if (stock <= 0) {
    req.flash('error', 'Stok varian habis.');
    return redirectBack(req, res, '/shop');
  }

  const result = await cartModel.upsertCartItem(userId, Number(variant.product_variant_id), quantity, stock);

  if (result.clamped) {
    req.flash('error', `Jumlah disesuaikan ke stok tersedia (${result.quantity}).`);
  } else {
    req.flash('success', 'Produk berhasil ditambahkan ke keranjang.');
  }

  return res.redirect('/cart');
}

async function updateQuantity(req, res) {
  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    req.flash('error', req.formErrors.quantity || req.formErrors.id || 'Input quantity tidak valid.');
    return res.redirect('/cart');
  }

  const userId = req.session.user.id;
  const itemId = Number(req.params.id);
  const quantity = parseQuantity(req.body.quantity, 1);

  const cartItem = await cartModel.findCartItemByIdAndUser(itemId, userId);
  if (!cartItem) {
    req.flash('error', 'Item keranjang tidak ditemukan.');
    return res.redirect('/cart');
  }

  const variant = await cartModel.findVariantById(cartItem.product_variant_id);
  if (!variant || variant.product_status !== 'active') {
    req.flash('error', 'Produk tidak tersedia lagi.');
    return res.redirect('/cart');
  }

  if (variant.variant_status && variant.variant_status !== 'active') {
    req.flash('error', 'Varian produk tidak tersedia lagi.');
    return res.redirect('/cart');
  }

  const stock = Number(variant.stock || 0);
  if (stock <= 0) {
    req.flash('error', 'Stok varian habis.');
    return res.redirect('/cart');
  }

  if (quantity > stock) {
    req.flash('error', `Jumlah melebihi stok. Maksimal ${stock}.`);
    return res.redirect('/cart');
  }

  await cartModel.updateItemQuantityByUser(itemId, userId, quantity);
  req.flash('success', 'Jumlah item berhasil diperbarui.');
  return res.redirect('/cart');
}

async function removeItem(req, res) {
  if (req.formErrors && Object.keys(req.formErrors).length > 0) {
    req.flash('error', req.formErrors.id || 'Item keranjang tidak valid.');
    return res.redirect('/cart');
  }

  const userId = req.session.user.id;
  const itemId = Number(req.params.id);

  const removed = await cartModel.removeItemByUser(itemId, userId);
  if (!removed) {
    req.flash('error', 'Item tidak ditemukan atau bukan milik akun kamu.');
    return res.redirect('/cart');
  }

  req.flash('success', 'Item dihapus dari keranjang.');
  return res.redirect('/cart');
}

module.exports = {
  showCart,
  addItem,
  updateQuantity,
  removeItem,
};
