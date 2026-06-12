const staffModel = require('../models/staff.model');
const auditService = require('../services/audit.service');

const ORDER_LIMIT = 10;
const STOCK_LIMIT = 10;
const PRODUCT_LIMIT = 10;

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function redirectBack(req, res, fallback = '/staff/dashboard') {
  return res.redirect(req.get('Referer') || fallback);
}

function getBaseRenderData(pageTitle) {
  return {
    layout: 'layouts/dashboard',
    pageTitle,
    dashboardSkin: 'staff',
    pageStyles: ['/css/staff/staff-layout.css'],
  };
}

function getOrderFilters(query) {
  return {
    q: String(query.q || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

function getStockFilters(query) {
  return {
    q: String(query.q || '').trim(),
    stock: String(query.stock || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

function getProductFilters(query) {
  return {
    q: String(query.q || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

async function dashboard(req, res, next) {
  try {
    const summary = await staffModel.getDashboardSummary();
    return res.render('staff/dashboard', {
      ...getBaseRenderData('Staff Dashboard'),
      activeMenu: 'dashboard',
      summary,
    });
  } catch (error) {
    return next(error);
  }
}

async function orders(req, res, next) {
  try {
    const filters = getOrderFilters(req.query);
    const [ordersList, total] = await Promise.all([
      staffModel.listOrders({ ...filters, limit: ORDER_LIMIT }),
      staffModel.countOrders(filters),
    ]);

    return res.render('staff/orders', {
      ...getBaseRenderData('Staff Orders'),
      activeMenu: 'orders',
      filters,
      orders: ordersList,
      orderStatuses: Array.from(staffModel.STAFF_ORDER_STATUSES),
      pagination: {
        page: filters.page,
        limit: ORDER_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / ORDER_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function orderDetail(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    if (!isValidId(orderId)) {
      req.flash('error', 'Order tidak valid.');
      return res.redirect('/staff/orders');
    }

    const [order, items] = await Promise.all([
      staffModel.getOrderDetail(orderId),
      staffModel.getOrderItems(orderId),
    ]);

    if (!order) {
      req.flash('error', 'Order tidak ditemukan atau tidak tersedia untuk staff.');
      return res.redirect('/staff/orders');
    }

    return res.render('staff/order-detail', {
      ...getBaseRenderData(order.invoice_number || order.order_code || 'Order Detail'),
      activeMenu: 'orders',
      order,
      items,
      orderStatuses: Array.from(staffModel.STAFF_ORDER_STATUSES),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  const orderId = Number(req.params.id);
  if (!isValidId(orderId)) {
    req.flash('error', 'Order tidak valid.');
    return res.redirect('/staff/orders');
  }

  try {
    const oldOrder = await staffModel.getOrderDetail(orderId);
    await staffModel.updateOrderStatus(orderId, req.body.status);
    const newOrder = await staffModel.getOrderDetail(orderId);
    await auditService.logActivity(req, {
      action: 'STAFF_ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: orderId,
      oldValues: oldOrder ? { status: oldOrder.status, order_status: oldOrder.order_status } : null,
      newValues: newOrder ? { status: newOrder.status, order_status: newOrder.order_status } : { status: req.body.status },
    });
    req.flash('success', 'Status order berhasil diperbarui.');
    return res.redirect(`/staff/orders/${orderId}`);
  } catch (error) {
    if (['INVALID_STATUS', 'ORDER_NOT_FOUND', 'INVALID_TRANSITION', 'TRACKING_REQUIRED'].includes(error.code)) {
      req.flash('error', error.message);
      return res.redirect(`/staff/orders/${orderId}`);
    }

    return next(error);
  }
}

async function updateTracking(req, res, next) {
  const orderId = Number(req.params.id);
  if (!isValidId(orderId)) {
    req.flash('error', 'Order tidak valid.');
    return res.redirect('/staff/orders');
  }

  try {
    const oldOrder = await staffModel.getOrderDetail(orderId);
    const updated = await staffModel.updateTracking(orderId, {
      courier: req.body.courier,
      trackingNumber: req.body.tracking_number,
    });

    if (!updated) {
      req.flash('error', 'Tracking tidak dapat diperbarui untuk order ini.');
      return res.redirect(`/staff/orders/${orderId}`);
    }

    const newOrder = await staffModel.getOrderDetail(orderId);
    await auditService.logActivity(req, {
      action: 'STAFF_ORDER_TRACKING_UPDATED',
      entityType: 'order',
      entityId: orderId,
      oldValues: oldOrder ? { courier: oldOrder.courier, tracking_number: oldOrder.tracking_number } : null,
      newValues: newOrder ? { courier: newOrder.courier, tracking_number: newOrder.tracking_number } : {
        courier: req.body.courier,
        tracking_number: req.body.tracking_number,
      },
    });

    req.flash('success', 'Tracking berhasil diperbarui.');
    return res.redirect(`/staff/orders/${orderId}`);
  } catch (error) {
    return next(error);
  }
}

async function stocks(req, res, next) {
  try {
    const filters = getStockFilters(req.query);
    const [stocksList, total] = await Promise.all([
      staffModel.listStocks({ ...filters, limit: STOCK_LIMIT }),
      staffModel.countStocks(filters),
    ]);

    return res.render('staff/stocks', {
      ...getBaseRenderData('Staff Inventory'),
      activeMenu: 'stocks',
      filters,
      stocks: stocksList,
      lowStockThreshold: staffModel.LOW_STOCK_THRESHOLD,
      pagination: {
        page: filters.page,
        limit: STOCK_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / STOCK_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStock(req, res, next) {
  const variantId = Number(req.params.variantId);
  const stock = Number(req.body.stock);

  if (!isValidId(variantId)) {
    req.flash('error', 'Variant tidak valid.');
    return redirectBack(req, res, '/staff/stocks');
  }

  if (!Number.isInteger(stock) || stock < 0) {
    req.flash('error', 'Stock harus berupa angka bulat minimal 0.');
    return redirectBack(req, res, '/staff/stocks');
  }

  try {
    const variant = await staffModel.findVariantById(variantId);
    if (!variant) {
      req.flash('error', 'Variant tidak ditemukan.');
      return redirectBack(req, res, '/staff/stocks');
    }

    await staffModel.updateVariantStock(variantId, stock);
    await auditService.logActivity(req, {
      action: 'STAFF_STOCK_UPDATED',
      entityType: 'product_variant',
      entityId: variantId,
      oldValues: { stock: variant.stock, variant_sku: variant.variant_sku, product_name: variant.product_name },
      newValues: { stock, variant_sku: variant.variant_sku, product_name: variant.product_name },
    });
    req.flash('success', `Stock ${variant.product_name} (${variant.variant_sku || 'variant'}) berhasil diperbarui.`);
    return redirectBack(req, res, '/staff/stocks');
  } catch (error) {
    return next(error);
  }
}

async function products(req, res, next) {
  try {
    const filters = getProductFilters(req.query);
    const [productsList, total] = await Promise.all([
      staffModel.listProducts({ ...filters, limit: PRODUCT_LIMIT }),
      staffModel.countProducts(filters),
    ]);

    return res.render('staff/products', {
      ...getBaseRenderData('Staff Products'),
      activeMenu: 'products',
      filters,
      products: productsList,
      pagination: {
        page: filters.page,
        limit: PRODUCT_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / PRODUCT_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  orders,
  orderDetail,
  updateOrderStatus,
  updateTracking,
  stocks,
  updateStock,
  products,
};
