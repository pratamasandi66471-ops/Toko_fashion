const fs = require('fs');

const categoryModel = require('../models/category.model');
const productModel = require('../models/product.model');
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

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toStock(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
}

function viewData(extra = {}) {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'products',
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/products.css'],
    pageScripts: ['/js/admin-products.js'],
    ...extra,
  };
}

function isChecked(value) {
  return ['on', 'true', '1', true].includes(value);
}

function removeUploadedFile(file) {
  if (!file?.path) return;

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (_error) {
    // Upload cleanup is best-effort; the user-facing error is handled by the caller.
  }
}

function normalizeVariantInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.keys(input).sort().map((key) => input[key]);
}

function normalizeProductBody(body) {
  const price = toNullableNumber(body.price);
  const discountPrice = toNullableNumber(body.discount_price);

  return {
    categoryId: Number(body.category_id),
    name: (body.name || '').trim(),
    slug: makeSlug((body.slug || '').trim() || body.name),
    description: (body.description || '').trim(),
    price,
    discountPrice,
    sku: (body.sku || '').trim(),
    status: body.status || 'active',
    isFeatured: ['on', 'true', '1', true].includes(body.is_featured),
  };
}

function normalizeVariantBody(body) {
  const stock = toStock(body.stock);
  const priceOverride = toNullableNumber(body.price_override);

  return {
    size: (body.size || '').trim(),
    color: (body.color || '').trim(),
    colorCode: (body.color_code || '').trim(),
    stock,
    priceOverride,
    status: body.status || 'active',
    variantSku: (body.variant_sku || '').trim(),
  };
}

async function validateProduct(payload, excludeId = null) {
  const formErrors = {};

  if (!payload.name) formErrors.name = 'Nama produk wajib diisi.';
  if (!payload.slug) formErrors.slug = 'Slug produk wajib diisi.';
  if (!payload.sku) formErrors.sku = 'SKU wajib diisi.';
  if (!Number.isInteger(payload.categoryId) || payload.categoryId < 1) formErrors.category_id = 'Kategori wajib dipilih.';
  if (!Number.isFinite(payload.price) || payload.price < 0) formErrors.price = 'Harga wajib diisi dan minimal 0.';
  if (payload.discountPrice !== null && (!Number.isFinite(payload.discountPrice) || payload.discountPrice < 0)) {
    formErrors.discount_price = 'Harga diskon minimal 0.';
  }
  if (!['draft', 'active', 'inactive'].includes(payload.status)) formErrors.status = 'Status produk tidak valid.';

  if (payload.sku && await productModel.isSkuTaken(payload.sku, excludeId)) formErrors.sku = 'SKU produk sudah dipakai.';
  if (payload.slug && await productModel.isSlugTaken(payload.slug, excludeId)) formErrors.slug = 'Slug produk sudah dipakai.';

  return formErrors;
}

async function validateVariant(variant, excludeId = null) {
  const formErrors = {};

  if (!variant.size) formErrors.size = 'Size wajib diisi.';
  if (!variant.color) formErrors.color = 'Color wajib diisi.';
  if (!variant.variantSku) formErrors.variant_sku = 'Variant SKU wajib diisi.';
  if (!Number.isFinite(variant.stock) || variant.stock < 0) formErrors.stock = 'Stock minimal 0.';
  if (variant.priceOverride !== null && (!Number.isFinite(variant.priceOverride) || variant.priceOverride < 0)) {
    formErrors.price_override = 'Price override minimal 0.';
  }
  if (!['active', 'inactive'].includes(variant.status)) formErrors.status = 'Status variant tidak valid.';

  if (variant.variantSku && await productModel.isVariantSkuTaken(variant.variantSku, excludeId)) {
    formErrors.variant_sku = 'Variant SKU sudah dipakai.';
  }

  return formErrors;
}

async function renderProductForm(res, template, data) {
  const categories = await categoryModel.listCategories({ status: 'active' });
  return res.render(template, viewData({ categories, ...data }));
}

async function index(req, res, next) {
  try {
    const filters = {
      search: (req.query.search || '').trim(),
      categoryId: req.query.category_id ? Number(req.query.category_id) : null,
      status: req.query.status || '',
      lowStock: req.query.low_stock === '1',
      page: req.query.page,
      limit: 12,
    };

    const [{ rows: products, pagination }, categories] = await Promise.all([
      productModel.listProducts(filters),
      categoryModel.listCategories(),
    ]);

    return res.render('admin/products/index', viewData({
      pageTitle: 'Products',
      products,
      pagination,
      categories,
      filters,
    }));
  } catch (error) {
    return next(error);
  }
}

async function showCreate(req, res, next) {
  try {
    return renderProductForm(res, 'admin/products/create', {
      pageTitle: 'Create Product',
      old: { status: 'active', is_featured: false },
      variants: [{}],
      formErrors: {},
      variantErrors: [],
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const payload = normalizeProductBody(req.body);
    payload.createdBy = req.session.user?.id || null;

    const rawVariants = normalizeVariantInput(req.body.variants);
    const variants = rawVariants
      .map(normalizeVariantBody)
      .filter((variant) => variant.size || variant.color || variant.variantSku || Number.isFinite(variant.stock));

    const formErrors = await validateProduct(payload);
    const variantErrors = [];

    for (let i = 0; i < variants.length; i += 1) {
      variantErrors[i] = await validateVariant(variants[i]);
    }

    if (variants.length === 0) {
      variantErrors[0] = { general: 'Minimal satu variant wajib diisi.' };
      variants.push({});
    }

    const hasVariantErrors = variantErrors.some((item) => item && Object.keys(item).length > 0);

    if (Object.keys(formErrors).length > 0 || hasVariantErrors) {
      res.status(422);
      return renderProductForm(res, 'admin/products/create', {
        pageTitle: 'Create Product',
        old: { ...req.body, ...payload },
        variants,
        formErrors,
        variantErrors,
      });
    }

    const productId = await productModel.createProduct(payload, variants);
    await auditService.logActivity(req, {
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: productId,
      newValues: {
        ...payload,
        variants: variants.map((variant) => ({
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          status: variant.status,
          variantSku: variant.variantSku,
        })),
      },
    });
    req.flash('success', 'Produk berhasil dibuat. Silakan upload gambar produk.');
    return res.redirect(`/admin/products/${productId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  try {
    const data = await productModel.getProductEditorData(Number(req.params.id));
    if (!data) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    return renderProductForm(res, 'admin/products/edit', {
      pageTitle: 'Edit Product',
      ...data,
      old: data.product,
      formErrors: {},
      variantErrors: {},
      imageErrors: {},
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const data = await productModel.getProductEditorData(productId);
    if (!data) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    const payload = normalizeProductBody(req.body);
    const formErrors = await validateProduct(payload, productId);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return renderProductForm(res, 'admin/products/edit', {
        pageTitle: 'Edit Product',
        ...data,
        old: { ...data.product, ...req.body, ...payload },
        formErrors,
        variantErrors: {},
        imageErrors: {},
      });
    }

    await productModel.updateProduct(productId, payload);
    const updatedProduct = await productModel.findById(productId);
    await auditService.logActivity(req, {
      action: 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: productId,
      oldValues: data.product,
      newValues: updatedProduct || payload,
    });
    req.flash('success', 'Produk berhasil diperbarui.');
    return res.redirect(`/admin/products/${productId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const product = await productModel.findById(productId);
    const updated = await productModel.toggleStatus(productId);
    const updatedProduct = updated ? await productModel.findById(productId) : null;
    if (updated) {
      await auditService.logActivity(req, {
        action: 'PRODUCT_STATUS_TOGGLED',
        entityType: 'product',
        entityId: productId,
        oldValues: product ? { status: product.status, name: product.name, sku: product.sku } : null,
        newValues: updatedProduct ? { status: updatedProduct.status, name: updatedProduct.name, sku: updatedProduct.sku } : null,
      });
    }
    req.flash(updated ? 'success' : 'error', updated ? 'Status produk diperbarui.' : 'Produk tidak ditemukan.');
    return res.redirect('/admin/products');
  } catch (error) {
    return next(error);
  }
}

async function addVariant(req, res, next) {
  const productId = Number(req.params.id);
  try {
    const product = await productModel.findById(productId);
    if (!product) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    const variant = normalizeVariantBody(req.body);
    const errors = await validateVariant(variant);

    if (Object.keys(errors).length > 0) {
      req.flash('error', Object.values(errors)[0]);
      return res.redirect(`/admin/products/${productId}/edit`);
    }

    await productModel.addVariant(productId, variant);
    req.flash('success', 'Variant berhasil ditambahkan.');
    return res.redirect(`/admin/products/${productId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function updateVariant(req, res, next) {
  try {
    const variantId = Number(req.params.variantId);
    const existing = await productModel.findVariantById(variantId);
    if (!existing) {
      req.flash('error', 'Variant tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    const variant = normalizeVariantBody(req.body);
    const errors = await validateVariant(variant, variantId);

    if (Object.keys(errors).length > 0) {
      req.flash('error', Object.values(errors)[0]);
      return res.redirect(`/admin/products/${existing.product_id}/edit`);
    }

    await productModel.updateVariant(variantId, variant);
    req.flash('success', 'Variant berhasil diperbarui.');
    return res.redirect(`/admin/products/${existing.product_id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function deleteVariant(req, res, next) {
  try {
    const variant = await productModel.findVariantById(Number(req.params.variantId));
    if (!variant) {
      req.flash('error', 'Variant tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    try {
      await productModel.deleteVariant(variant.id);
      req.flash('success', 'Variant berhasil dihapus.');
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        await productModel.updateVariant(variant.id, { ...variant, status: 'inactive', variantSku: variant.variant_sku, colorCode: variant.color_code, priceOverride: variant.price_override });
        req.flash('success', 'Variant sudah dipakai transaksi, jadi statusnya dinonaktifkan.');
      } else {
        throw error;
      }
    }

    return res.redirect(`/admin/products/${variant.product_id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function addImage(req, res, next) {
  const productId = Number(req.params.id);
  try {
    const product = await productModel.findById(productId);
    if (!product) {
      removeUploadedFile(req.file);
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    if (!req.file) {
      req.flash('error', 'Pilih gambar terlebih dahulu.');
      return res.redirect(`/admin/products/${productId}/edit`);
    }

    const imageUrl = `/uploads/products/${req.file.filename}`;
    await productModel.addProductImage({
      productId,
      imageUrl,
      isPrimary: isChecked(req.body.is_primary),
    });

    req.flash('success', 'Gambar produk ditambahkan.');
    return res.redirect(`/admin/products/${productId}/edit`);
  } catch (error) {
    removeUploadedFile(req.file);
    console.error(error);
    req.flash('error', 'Gagal menyimpan gambar produk.');
    return res.redirect(`/admin/products/${productId}/edit`);
  }
}

async function deleteImage(req, res, next) {
  try {
    const image = await productModel.findImageById(Number(req.params.imageId));
    if (!image) {
      req.flash('error', 'Gambar tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    await productModel.deleteProductImage(image.id);
    req.flash('success', 'Gambar produk dihapus.');
    return res.redirect(`/admin/products/${image.product_id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function setPrimaryImage(req, res, next) {
  try {
    const image = await productModel.findImageById(Number(req.params.imageId));
    if (!image) {
      req.flash('error', 'Gambar tidak ditemukan.');
      return res.redirect('/admin/products');
    }

    await productModel.setPrimaryImage(image.id);
    req.flash('success', 'Gambar utama diperbarui.');
    return res.redirect(`/admin/products/${image.product_id}/edit`);
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
  addVariant,
  updateVariant,
  deleteVariant,
  addImage,
  deleteImage,
  setPrimaryImage,
};
