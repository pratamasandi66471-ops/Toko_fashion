const adminReportModel = require('../models/adminReport.model');

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function getDefaultFilters(query) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  let dateFrom = isDateInput(query.date_from) ? String(query.date_from).trim() : formatDateInput(start);
  let dateTo = isDateInput(query.date_to) ? String(query.date_to).trim() : formatDateInput(today);

  if (dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  return { dateFrom, dateTo };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'reports',
    pageStyles: ['/css/admin/pages/reports.css'],
    currentDateWib: getWibDateLabel(),
  };
}

async function index(req, res, next) {
  try {
    const filters = getDefaultFilters(req.query);

    const [
      salesSummary,
      revenueByDate,
      ordersSummary,
      ordersByStatus,
      productsReport,
      inventoryReport,
      customersReport,
    ] = await Promise.all([
      adminReportModel.getSalesSummary(filters),
      adminReportModel.getRevenueByDate(filters),
      adminReportModel.getOrdersSummary(filters),
      adminReportModel.getOrdersByStatus(filters),
      adminReportModel.getProductsReport({ ...filters, limit: 10 }),
      adminReportModel.getInventoryReport(),
      adminReportModel.getCustomersReport({ ...filters, limit: 10 }),
    ]);

    return res.render('admin/reports/index', {
      ...getBaseRenderData(),
      pageTitle: 'Reports',
      filters,
      salesSummary,
      revenueByDate,
      ordersSummary,
      ordersByStatus,
      productsReport,
      inventoryReport,
      customersReport,
      lowStockThreshold: adminReportModel.LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
