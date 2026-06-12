const adminInventoryModel = require('../models/adminInventory.model');
const categoryModel = require('../models/category.model');
const auditService = require('../services/audit.service');

const INVENTORY_LIMIT = 15;

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

function redirectBack(req, res) {
  return res.redirect(req.get('Referer') || '/admin/inventory');
}

function getFilters(query) {
  return {
    q: String(query.q || '').trim(),
    category: String(query.category || '').trim(),
    stock: String(query.stock || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    pageTitle: 'Inventory',
    activeMenu: 'inventory',
    pageStyles: ['/css/admin/pages/inventory.css'],
    currentDateWib: getWibDateLabel(),
  };
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [inventory, total, summary, categories] = await Promise.all([
      adminInventoryModel.listInventory({ ...filters, limit: INVENTORY_LIMIT }),
      adminInventoryModel.countInventory(filters),
      adminInventoryModel.getInventorySummary(),
      categoryModel.listActiveCategories(),
    ]);

    return res.render('admin/inventory/index', {
      ...getBaseRenderData(),
      filters,
      inventory,
      summary,
      categories,
      pagination: {
        page: filters.page,
        limit: INVENTORY_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / INVENTORY_LIMIT)),
      },
      lowStockThreshold: adminInventoryModel.LOW_STOCK_THRESHOLD,
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
    return redirectBack(req, res);
  }

  if (!Number.isInteger(stock) || stock < 0) {
    req.flash('error', 'Stock harus berupa angka bulat minimal 0.');
    return redirectBack(req, res);
  }

  try {
    const variant = await adminInventoryModel.findVariantById(variantId);

    if (!variant) {
      req.flash('error', 'Variant tidak ditemukan.');
      return redirectBack(req, res);
    }

    await adminInventoryModel.updateStock(variantId, stock);
    await auditService.logActivity(req, {
      action: 'STOCK_UPDATED',
      entityType: 'product_variant',
      entityId: variantId,
      oldValues: { stock: variant.stock, variant_sku: variant.variant_sku, product_name: variant.product_name },
      newValues: { stock, variant_sku: variant.variant_sku, product_name: variant.product_name },
    });
    req.flash('success', `Stock ${variant.product_name} (${variant.variant_sku || 'variant'}) berhasil diperbarui.`);
    return redirectBack(req, res);
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next) {
  const variantId = Number(req.params.variantId);

  if (!isValidId(variantId)) {
    req.flash('error', 'Variant tidak valid.');
    return redirectBack(req, res);
  }

  try {
    const variant = await adminInventoryModel.findVariantById(variantId);

    if (!variant) {
      req.flash('error', 'Variant tidak ditemukan.');
      return redirectBack(req, res);
    }

    await adminInventoryModel.toggleVariantStatus(variantId);
    const updatedVariant = await adminInventoryModel.findVariantById(variantId);
    await auditService.logActivity(req, {
      action: 'VARIANT_STATUS_TOGGLED',
      entityType: 'product_variant',
      entityId: variantId,
      oldValues: { status: variant.variant_status, variant_sku: variant.variant_sku, product_name: variant.product_name },
      newValues: {
        status: updatedVariant?.variant_status || null,
        variant_sku: variant.variant_sku,
        product_name: variant.product_name,
      },
    });
    req.flash('success', `Status ${variant.product_name} (${variant.variant_sku || 'variant'}) berhasil diperbarui.`);
    return redirectBack(req, res);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  updateStock,
  toggleStatus,
};
