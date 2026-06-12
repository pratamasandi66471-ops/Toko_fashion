const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const cartController = require('../controllers/cart.controller');
const orderController = require('../controllers/order.controller');
const storefrontController = require('../controllers/storefront.controller');
const customerProfileController = require('../controllers/customerProfile.controller');

const router = express.Router();
const customerOnly = [requireAuth, requireRole('customer')];

function handleValidation(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    req.formErrors = {};
    return next();
  }

  req.formErrors = result.array().reduce((acc, error) => {
    const key = error.path || '_error';
    if (!acc[key]) {
      acc[key] = error.msg;
    }
    return acc;
  }, {});

  return next();
}

const addCartValidationRules = [
  body('quantity')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Quantity minimal 1.'),
  body('product_variant_id')
    .notEmpty()
    .withMessage('Varian produk wajib dipilih.')
    .isInt({ min: 1 })
    .withMessage('Variant produk tidak valid.'),
];

const updateCartValidationRules = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Item keranjang tidak valid.'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity minimal 1.'),
];

const removeCartValidationRules = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Item keranjang tidak valid.'),
];

const addressValidationRules = [
  body('recipient_name')
    .trim()
    .notEmpty()
    .withMessage('Nama penerima wajib diisi.'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Nomor telepon wajib diisi.')
    .isLength({ min: 8, max: 30 })
    .withMessage('Nomor telepon tidak valid.'),
  body('province')
    .trim()
    .notEmpty()
    .withMessage('Provinsi wajib diisi.'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('Kota wajib diisi.'),
  body('district')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Kecamatan tidak valid.'),
  body('postal_code')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Kode pos tidak valid.'),
  body('full_address')
    .trim()
    .notEmpty()
    .withMessage('Alamat lengkap wajib diisi.'),
];

const profileValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nama wajib diisi.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama harus 2-100 karakter.'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('Nomor telepon maksimal 30 karakter.'),
];

const passwordValidationRules = [
  body('current_password')
    .notEmpty()
    .withMessage('Password saat ini wajib diisi.'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Password baru minimal 8 karakter.'),
  body('confirm_password')
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage('Konfirmasi password tidak sama.'),
];

const addressIdValidationRules = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Alamat tidak valid.'),
];

const placeOrderValidationRules = [
  body('address_id')
    .isInt({ min: 1 })
    .withMessage('Alamat pengiriman wajib dipilih.'),
  body('shipping_method')
    .trim()
    .notEmpty()
    .withMessage('Metode pengiriman wajib dipilih.')
    .isLength({ max: 50 })
    .withMessage('Metode pengiriman tidak valid.'),
  body('payment_method')
    .isIn(['bank_transfer', 'cod'])
    .withMessage('Metode pembayaran tidak valid.'),
  body('notes')
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Catatan maksimal 500 karakter.'),
];

router.get('/', storefrontController.showHome);

router.get('/shop', storefrontController.showShop);
router.get('/shop/:slug', storefrontController.showProductDetail);

router.get('/profile', ...customerOnly, customerProfileController.showOverview);
router.get('/profile/info', ...customerOnly, customerProfileController.showInfo);
router.get('/profile/addresses', ...customerOnly, customerProfileController.showAddresses);
router.get('/profile/orders', ...customerOnly, customerProfileController.showOrders);
router.get('/profile/security', ...customerOnly, customerProfileController.showSecurity);
router.post('/profile', ...customerOnly, profileValidationRules, handleValidation, customerProfileController.updateProfile);
router.post('/profile/password', ...customerOnly, passwordValidationRules, handleValidation, customerProfileController.updatePassword);
router.post('/profile/addresses', ...customerOnly, addressValidationRules, handleValidation, customerProfileController.createAddress);
router.get('/profile/addresses/:id/edit', ...customerOnly, addressIdValidationRules, handleValidation, customerProfileController.editAddress);
router.post('/profile/addresses/:id/update', ...customerOnly, addressIdValidationRules, addressValidationRules, handleValidation, customerProfileController.updateAddress);
router.post('/profile/addresses/:id/default', ...customerOnly, addressIdValidationRules, handleValidation, customerProfileController.setDefaultAddress);
router.post('/profile/addresses/:id/delete', ...customerOnly, addressIdValidationRules, handleValidation, customerProfileController.deleteAddress);

router.get('/cart', ...customerOnly, cartController.showCart);
router.post('/cart/add', ...customerOnly, addCartValidationRules, handleValidation, cartController.addItem);
router.patch('/cart/items/:id', ...customerOnly, updateCartValidationRules, handleValidation, cartController.updateQuantity);
router.delete('/cart/items/:id', ...customerOnly, removeCartValidationRules, handleValidation, cartController.removeItem);

router.get('/checkout', ...customerOnly, orderController.showCheckout);
router.post('/checkout/address', ...customerOnly, addressValidationRules, handleValidation, orderController.saveAddress);
router.post('/checkout', ...customerOnly, placeOrderValidationRules, handleValidation, orderController.placeOrder);
router.get('/checkout/success/:invoiceNumber', ...customerOnly, orderController.showOrderSuccess);

module.exports = router;
