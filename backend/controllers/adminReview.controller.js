const adminReviewModel = require('../models/adminReview.model');

const REVIEW_LIMIT = 10;

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
    rating: String(query.rating || '').trim(),
    productId: String(query.productId || query.product_id || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'reviews',
    pageStyles: ['/css/admin/pages/reviews.css'],
    currentDateWib: getWibDateLabel(),
  };
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [reviews, total, products] = await Promise.all([
      adminReviewModel.listReviews({ ...filters, limit: REVIEW_LIMIT }),
      adminReviewModel.countReviews(filters),
      adminReviewModel.getProductsForFilter(),
    ]);

    return res.render('admin/reviews/index', {
      ...getBaseRenderData(),
      pageTitle: 'Reviews',
      filters,
      reviews,
      products,
      pagination: {
        page: filters.page,
        limit: REVIEW_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / REVIEW_LIMIT)),
      },
      ratingOptions: [5, 4, 3, 2, 1],
    });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  const reviewId = Number(req.params.id);
  if (!isValidId(reviewId)) {
    req.flash('error', 'Review tidak valid.');
    return res.redirect('/admin/reviews');
  }

  try {
    const review = await adminReviewModel.getReviewDetail(reviewId);

    if (!review) {
      req.flash('error', 'Review tidak ditemukan.');
      return res.redirect('/admin/reviews');
    }

    return res.render('admin/reviews/detail', {
      ...getBaseRenderData(),
      pageTitle: `Review #${review.id}`,
      review,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteReview(req, res, next) {
  const reviewId = Number(req.params.id);
  if (!isValidId(reviewId)) {
    req.flash('error', 'Review tidak valid.');
    return res.redirect('/admin/reviews');
  }

  try {
    const review = await adminReviewModel.getReviewDetail(reviewId);

    if (!review) {
      req.flash('error', 'Review tidak ditemukan.');
      return res.redirect('/admin/reviews');
    }

    const affectedRows = await adminReviewModel.deleteReview(reviewId);

    if (!affectedRows) {
      req.flash('error', 'Review gagal dihapus atau sudah tidak tersedia.');
      return res.redirect('/admin/reviews');
    }

    req.flash('success', 'Review berhasil dihapus.');
    return res.redirect('/admin/reviews');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  show,
  delete: deleteReview,
};
