const adminUserModel = require('../models/adminUser.model');
const auditService = require('../services/audit.service');

const CUSTOMER_LIMIT = 10;

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

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function getFilters(query) {
  return {
    q: String(query.q || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'customers',
    pageStyles: ['/css/admin/pages/customers.css'],
    currentDateWib: getWibDateLabel(),
  };
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [customers, total] = await Promise.all([
      adminUserModel.listCustomers({ ...filters, limit: CUSTOMER_LIMIT }),
      adminUserModel.countCustomers(filters),
    ]);

    return res.render('admin/customers/index', {
      ...getBaseRenderData(),
      pageTitle: 'Customers',
      filters,
      customers,
      allowedStatuses: Array.from(adminUserModel.ALLOWED_USER_STATUSES),
      pagination: {
        page: filters.page,
        limit: CUSTOMER_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / CUSTOMER_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  const customerId = Number(req.params.id);
  if (!isValidId(customerId)) {
    req.flash('error', 'Customer tidak valid.');
    return res.redirect('/admin/customers');
  }

  try {
    const [customer, addresses, recentOrders] = await Promise.all([
      adminUserModel.getCustomerDetail(customerId),
      adminUserModel.getCustomerAddresses(customerId),
      adminUserModel.getCustomerRecentOrders(customerId, 8),
    ]);

    if (!customer) {
      req.flash('error', 'Customer tidak ditemukan.');
      return res.redirect('/admin/customers');
    }

    return res.render('admin/customers/detail', {
      ...getBaseRenderData(),
      pageTitle: customer.name || 'Customer Detail',
      customer,
      addresses,
      recentOrders,
      allowedStatuses: Array.from(adminUserModel.ALLOWED_USER_STATUSES),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  const customerId = Number(req.params.id);
  if (!isValidId(customerId)) {
    req.flash('error', 'Customer tidak valid.');
    return res.redirect('/admin/customers');
  }

  try {
    const customer = await adminUserModel.getCustomerDetail(customerId);
    const affectedRows = await adminUserModel.updateUserStatus(
      customerId,
      req.body.status,
      adminUserModel.CUSTOMER_ROLE
    );

    if (!affectedRows) {
      req.flash('error', 'Customer tidak ditemukan atau status tidak berubah.');
      return res.redirect(`/admin/customers/${customerId}`);
    }

    const updatedCustomer = await adminUserModel.getCustomerDetail(customerId);
    await auditService.logActivity(req, {
      action: 'CUSTOMER_STATUS_UPDATED',
      entityType: 'user',
      entityId: customerId,
      oldValues: customer ? { status: customer.status, name: customer.name, email: customer.email, role: adminUserModel.CUSTOMER_ROLE } : null,
      newValues: updatedCustomer ? { status: updatedCustomer.status, name: updatedCustomer.name, email: updatedCustomer.email, role: adminUserModel.CUSTOMER_ROLE } : {
        status: req.body.status,
        role: adminUserModel.CUSTOMER_ROLE,
      },
    });

    req.flash('success', 'Status customer berhasil diperbarui.');
    return res.redirect(`/admin/customers/${customerId}`);
  } catch (error) {
    if (error.code === 'INVALID_USER_STATUS') {
      req.flash('error', error.message);
      return res.redirect(`/admin/customers/${customerId}`);
    }

    return next(error);
  }
}

module.exports = {
  index,
  show,
  updateStatus,
};
