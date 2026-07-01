const adminOrderModel = require('../models/adminOrder.model');
const auditService = require('../services/audit.service');

const ORDER_LIMIT = 10;

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getListFilters(query) {
  return {
    q: String(query.q || '').trim(),
    orderStatus: String(query.orderStatus || query.order_status || '').trim(),
    paymentStatus: String(query.paymentStatus || query.payment_status || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'orders',
    pageStyles: ['/css/admin/pages/orders.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

async function index(req, res, next) {
  try {
    const filters = getListFilters(req.query);
    const [orders, total] = await Promise.all([
      adminOrderModel.listOrders({ ...filters, limit: ORDER_LIMIT }),
      adminOrderModel.countOrders(filters),
    ]);

    return res.render('admin/orders/index', {
      ...getBaseRenderData(),
      pageTitle: 'Orders',
      filters,
      orders,
      pagination: {
        page: filters.page,
        limit: ORDER_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / ORDER_LIMIT)),
      },
      allowedOrderStatuses: Array.from(adminOrderModel.ALLOWED_ORDER_STATUSES),
      paymentStatuses: ['unpaid', 'pending_verification', 'paid', 'failed', 'refunded'],
    });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    if (!isValidId(orderId)) {
      req.flash('error', 'Order tidak valid.');
      return res.redirect('/admin/orders');
    }

    const [order, items] = await Promise.all([
      adminOrderModel.getOrderDetail(orderId),
      adminOrderModel.getOrderItems(orderId),
    ]);

    if (!order) {
      req.flash('error', 'Order tidak ditemukan.');
      return res.redirect('/admin/orders');
    }

    return res.render('admin/orders/detail', {
      ...getBaseRenderData(),
      pageTitle: order.invoice_number || order.order_code || 'Order Detail',
      order,
      items,
      allowedOrderStatuses: Array.from(adminOrderModel.ALLOWED_ORDER_STATUSES),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  const orderId = Number(req.params.id);
  if (!isValidId(orderId)) {
    req.flash('error', 'Order tidak valid.');
    return res.redirect('/admin/orders');
  }

  try {
    const oldOrder = await adminOrderModel.getOrderDetail(orderId);
    const affectedRows = await adminOrderModel.updateOrderStatus(orderId, req.body.status);

    if (!affectedRows) {
      req.flash('error', 'Order tidak ditemukan atau status tidak berubah.');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    const newOrder = await adminOrderModel.getOrderDetail(orderId);
    await auditService.logActivity(req, {
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: orderId,
      oldValues: oldOrder ? { status: oldOrder.status, order_status: oldOrder.order_status } : null,
      newValues: newOrder ? { status: newOrder.status, order_status: newOrder.order_status } : { status: req.body.status },
    });

    req.flash('success', 'Status order berhasil diperbarui.');
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    if (error.code === 'INVALID_ORDER_STATUS') {
      req.flash('error', error.message);
      return res.redirect(`/admin/orders/${orderId}`);
    }

    return next(error);
  }
}

async function updateTracking(req, res, next) {
  const orderId = Number(req.params.id);
  if (!isValidId(orderId)) {
    req.flash('error', 'Order tidak valid.');
    return res.redirect('/admin/orders');
  }

  try {
    const oldOrder = await adminOrderModel.getOrderDetail(orderId);
    const affectedRows = await adminOrderModel.updateTracking(orderId, {
      courier: req.body.courier,
      trackingNumber: req.body.tracking_number,
    });

    if (!affectedRows) {
      req.flash('error', 'Order tidak ditemukan.');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    const newOrder = await adminOrderModel.getOrderDetail(orderId);
    await auditService.logActivity(req, {
      action: 'ORDER_TRACKING_UPDATED',
      entityType: 'order',
      entityId: orderId,
      oldValues: oldOrder ? { courier: oldOrder.courier, tracking_number: oldOrder.tracking_number } : null,
      newValues: newOrder ? { courier: newOrder.courier, tracking_number: newOrder.tracking_number } : {
        courier: req.body.courier,
        tracking_number: req.body.tracking_number,
      },
    });

    req.flash('success', 'Data pengiriman berhasil diperbarui.');
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    return next(error);
  }
}

async function cancel(req, res, next) {
  const orderId = Number(req.params.id);
  if (!isValidId(orderId)) {
    req.flash('error', 'Order tidak valid.');
    return res.redirect('/admin/orders');
  }

  try {
    const oldOrder = await adminOrderModel.getOrderDetail(orderId);
    const affectedRows = await adminOrderModel.cancelOrder(orderId);

    if (!affectedRows) {
      req.flash('error', 'Order tidak bisa dibatalkan. Mungkin sudah completed atau cancelled.');
      return res.redirect(`/admin/orders/${orderId}`);
    }

    const newOrder = await adminOrderModel.getOrderDetail(orderId);
    await auditService.logActivity(req, {
      action: 'ORDER_CANCELLED',
      entityType: 'order',
      entityId: orderId,
      oldValues: oldOrder ? { status: oldOrder.status, order_status: oldOrder.order_status } : null,
      newValues: newOrder ? { status: newOrder.status, order_status: newOrder.order_status } : { status: 'cancelled' },
    });

    req.flash('success', 'Order berhasil dibatalkan.');
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    if (error.code === 'CANNOT_CANCEL_ORDER') {
      req.flash('error', error.message);
      return res.redirect(`/admin/orders/${orderId}`);
    }

    return next(error);
  }
}

module.exports = {
  index,
  show,
  updateStatus,
  updateTracking,
  cancel,
};
