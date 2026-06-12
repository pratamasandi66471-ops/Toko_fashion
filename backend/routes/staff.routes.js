const express = require('express');

const staffController = require('../controllers/staff.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();
const staffOnly = [requireAuth, requireRole('staff')];

router.get('/dashboard', ...staffOnly, staffController.dashboard);

router.get('/orders', ...staffOnly, staffController.orders);
router.get('/orders/:id', ...staffOnly, staffController.orderDetail);
router.post('/orders/:id/status', ...staffOnly, staffController.updateOrderStatus);
router.post('/orders/:id/tracking', ...staffOnly, staffController.updateTracking);

router.get('/stocks', ...staffOnly, staffController.stocks);
router.post('/stocks/:variantId/update', ...staffOnly, staffController.updateStock);

router.get('/products', ...staffOnly, staffController.products);

module.exports = router;
