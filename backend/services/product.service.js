const makeSlug = require('../helper/slugify');

const PRODUCT_STATUSES = new Set(['draft', 'active', 'inactive']);
const VARIANT_STATUSES = new Set(['active', 'inactive']);
const PRODUCT_IMAGE_FALLBACK = '/images/placeholder-product.jpg';

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toStock(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
}

function isChecked(value) {
  return ['on', 'true', '1', true, 1].includes(value);
}

function normalizeProductPayload(body = {}) {
  const price = toNullableNumber(body.price);
  const discountPrice = toNullableNumber(body.discount_price ?? body.discountPrice);
  const name = String(body.name || '').trim();
  const rawSlug = String(body.slug || '').trim();

  return {
    categoryId: Number(body.category_id ?? body.categoryId),
    name,
    slug: makeSlug(rawSlug || name),
    description: String(body.description || '').trim(),
    price,
    discountPrice,
    sku: String(body.sku || '').trim(),
    status: PRODUCT_STATUSES.has(body.status) ? body.status : 'active',
    isFeatured: isChecked(body.is_featured ?? body.isFeatured),
  };
}

function normalizeVariantPayload(body = {}) {
  const priceOverride = toNullableNumber(body.price_override ?? body.priceOverride);

  return {
    size: String(body.size || '').trim(),
    color: String(body.color || '').trim(),
    colorCode: String((body.color_code ?? body.colorCode) || '').trim(),
    stock: toStock(body.stock),
    priceOverride,
    status: VARIANT_STATUSES.has(body.status) ? body.status : 'active',
    variantSku: String((body.variant_sku ?? body.variantSku) || '').trim(),
  };
}

function normalizeVariantInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.keys(input).sort().map((key) => input[key]);
}

function validateProductPayload(payload) {
  const errors = {};

  if (!payload.name) errors.name = 'Nama produk wajib diisi.';
  if (!payload.slug) errors.slug = 'Slug produk wajib diisi.';
  if (!payload.sku) errors.sku = 'SKU wajib diisi.';
  if (!Number.isInteger(payload.categoryId) || payload.categoryId < 1) {
    errors.category_id = 'Kategori wajib dipilih.';
  }
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    errors.price = 'Harga wajib diisi dan minimal 0.';
  }
  if (payload.discountPrice !== null && (!Number.isFinite(payload.discountPrice) || payload.discountPrice < 0)) {
    errors.discount_price = 'Harga diskon minimal 0.';
  }
  if (!PRODUCT_STATUSES.has(payload.status)) {
    errors.status = 'Status produk tidak valid.';
  }

  return errors;
}

function validateVariantPayload(variant) {
  const errors = {};

  if (!variant.size) errors.size = 'Size wajib diisi.';
  if (!variant.color) errors.color = 'Color wajib diisi.';
  if (!variant.variantSku) errors.variant_sku = 'Variant SKU wajib diisi.';
  if (!Number.isFinite(variant.stock) || variant.stock < 0) {
    errors.stock = 'Stock minimal 0.';
  }
  if (variant.priceOverride !== null && (!Number.isFinite(variant.priceOverride) || variant.priceOverride < 0)) {
    errors.price_override = 'Price override minimal 0.';
  }
  if (!VARIANT_STATUSES.has(variant.status)) {
    errors.status = 'Status variant tidak valid.';
  }

  return errors;
}

function resolveProductImage(imageUrl) {
  return imageUrl || PRODUCT_IMAGE_FALLBACK;
}

module.exports = {
  PRODUCT_STATUSES,
  VARIANT_STATUSES,
  PRODUCT_IMAGE_FALLBACK,
  toNullableNumber,
  toStock,
  isChecked,
  normalizeProductPayload,
  normalizeVariantPayload,
  normalizeVariantInput,
  validateProductPayload,
  validateVariantPayload,
  resolveProductImage,
};
