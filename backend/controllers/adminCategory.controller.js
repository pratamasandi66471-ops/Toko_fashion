const categoryModel = require('../models/category.model');
const auditService = require('../services/audit.service');
const makeSlug = require('../helper/slugify');

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function viewData(extra = {}) {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'categories',
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/categories.css'],
    ...extra,
  };
}

async function validateCategory(body, excludeId = null) {
  const old = {
    name: (body.name || '').trim(),
    slug: (body.slug || '').trim(),
    description: (body.description || '').trim(),
    image: (body.image || '').trim(),
    status: body.status || 'active',
  };

  if (!old.slug) {
    old.slug = makeSlug(old.name);
  } else {
    old.slug = makeSlug(old.slug);
  }

  const formErrors = {};

  if (!old.name) formErrors.name = 'Nama kategori wajib diisi.';
  if (!old.slug) formErrors.slug = 'Slug kategori wajib diisi.';
  if (!['active', 'inactive'].includes(old.status)) formErrors.status = 'Status kategori tidak valid.';
  if (old.image && old.image.length > 255) formErrors.image = 'URL gambar maksimal 255 karakter.';

  if (old.slug && await categoryModel.isSlugTaken(old.slug, excludeId)) {
    formErrors.slug = 'Slug kategori sudah dipakai.';
  }

  return { old, formErrors };
}

async function index(req, res, next) {
  try {
    const filters = {
      search: (req.query.search || '').trim(),
      status: req.query.status || '',
    };
    const categories = await categoryModel.listCategories(filters);

    return res.render('admin/categories/index', viewData({
      pageTitle: 'Categories',
      categories,
      filters,
    }));
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return res.render('admin/categories/create', viewData({
    pageTitle: 'Create Category',
    old: { status: 'active' },
    formErrors: {},
  }));
}

async function create(req, res, next) {
  try {
    const { old, formErrors } = await validateCategory(req.body);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/categories/create', viewData({
        pageTitle: 'Create Category',
        old,
        formErrors,
      }));
    }

    const categoryId = await categoryModel.createCategory(old);
    await auditService.logActivity(req, {
      action: 'CATEGORY_CREATED',
      entityType: 'category',
      entityId: categoryId,
      newValues: old,
    });
    req.flash('success', 'Kategori berhasil dibuat.');
    return res.redirect('/admin/categories');
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  try {
    const category = await categoryModel.findById(Number(req.params.id));
    if (!category) {
      req.flash('error', 'Kategori tidak ditemukan.');
      return res.redirect('/admin/categories');
    }

    return res.render('admin/categories/edit', viewData({
      pageTitle: 'Edit Category',
      category,
      old: category,
      formErrors: {},
    }));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const categoryId = Number(req.params.id);
    const category = await categoryModel.findById(categoryId);

    if (!category) {
      req.flash('error', 'Kategori tidak ditemukan.');
      return res.redirect('/admin/categories');
    }

    const { old, formErrors } = await validateCategory(req.body, categoryId);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/categories/edit', viewData({
        pageTitle: 'Edit Category',
        category,
        old: { ...category, ...old },
        formErrors,
      }));
    }

    await categoryModel.updateCategory(categoryId, old);
    const updatedCategory = await categoryModel.findById(categoryId);
    await auditService.logActivity(req, {
      action: 'CATEGORY_UPDATED',
      entityType: 'category',
      entityId: categoryId,
      oldValues: category,
      newValues: updatedCategory || old,
    });
    req.flash('success', 'Kategori berhasil diperbarui.');
    return res.redirect('/admin/categories');
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const categoryId = Number(req.params.id);
    const category = await categoryModel.findById(categoryId);
    const updated = await categoryModel.toggleStatus(categoryId);
    const updatedCategory = updated ? await categoryModel.findById(categoryId) : null;
    if (updated) {
      await auditService.logActivity(req, {
        action: 'CATEGORY_STATUS_TOGGLED',
        entityType: 'category',
        entityId: categoryId,
        oldValues: category ? { status: category.status, name: category.name, slug: category.slug } : null,
        newValues: updatedCategory ? { status: updatedCategory.status, name: updatedCategory.name, slug: updatedCategory.slug } : null,
      });
    }
    req.flash(updated ? 'success' : 'error', updated ? 'Status kategori diperbarui.' : 'Kategori tidak ditemukan.');
    return res.redirect('/admin/categories');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  showCreate,
  create,
  showEdit,
  update,
  toggleStatus,
};
