const storefrontModel = require('../models/storefront.model');

const SHOP_LIMIT = 12;
const HOME_CATEGORY_LIMIT = 8;
const HOME_PRODUCT_LIMIT = 8;

function formatFilters(query) {
  return {
    q: (query.q || '').trim(),
    category: (query.category || '').trim(),
    sort: query.sort || 'latest',
    page: query.page || 1,
  };
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function showHome(req, res, next) {
  try {
    const [activeCategories, newArrivals, featuredProductsRaw] = await Promise.all([
      storefrontModel.getHomeCategories(HOME_CATEGORY_LIMIT),
      storefrontModel.getNewArrivals(HOME_PRODUCT_LIMIT),
      storefrontModel.getFeaturedProducts(HOME_PRODUCT_LIMIT),
    ]);

    const featuredProducts = featuredProductsRaw.length > 0
      ? featuredProductsRaw
      : newArrivals.slice(0, HOME_PRODUCT_LIMIT);

    return res.render('pages/home', {
      pageTitle: 'Home',
      activeCategories,
      newArrivals,
      featuredProducts,
    });
  } catch (error) {
    return next(error);
  }
}

async function showShop(req, res, next) {
  try {
    const filters = formatFilters(req.query);
    const page = normalizePage(filters.page);
    const [products, total, categories] = await Promise.all([
      storefrontModel.getShopProducts({ ...filters, page, limit: SHOP_LIMIT }),
      storefrontModel.countShopProducts(filters),
      storefrontModel.getActiveCategories(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / SHOP_LIMIT));

    return res.render('pages/shop', {
      pageTitle: 'Shop',
      products,
      categories,
      pagination: {
        page,
        limit: SHOP_LIMIT,
        total,
        totalPages,
      },
      filters: { ...filters, page },
    });
  } catch (error) {
    return next(error);
  }
}

async function showProductDetail(req, res, next) {
  try {
    const product = await storefrontModel.getProductBySlug(req.params.slug);

    if (!product) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/shop');
    }

    const [images, variants, relatedProducts] = await Promise.all([
      storefrontModel.getProductImages(product.id),
      storefrontModel.getProductVariants(product.id),
      storefrontModel.getRelatedProducts(product.category_id, product.id, 4),
    ]);

    return res.render('pages/produk-detail', {
      pageTitle: product.name,
      product,
      images,
      variants,
      relatedProducts,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showHome,
  showShop,
  showProductDetail,
};
