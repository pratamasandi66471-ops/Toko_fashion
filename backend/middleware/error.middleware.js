const AppError = require('../utils/AppError');

function wantsJson(req) {
  return req.xhr || req.accepts(['html', 'json']) === 'json';
}

function getDashboardPath(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin/dashboard';
  if (user.role === 'staff') return '/staff/dashboard';
  return '/';
}

function notFound(req, res, next) {
  if (req.originalUrl === '/favicon.ico') {
    return res.status(204).end();
  }

  next(new AppError(`Halaman ${req.originalUrl} tidak ditemukan.`, 404));
}

function normalizeError(error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  return {
    ...error,
    statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: error.message || 'Terjadi kesalahan pada server.',
    isOperational: error.isOperational === true,
    redirectTo: error.redirectTo || null,
    flashType: error.flashType || 'error',
    stack: error.stack,
  };
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = normalizedError.statusCode;
  const message = isProduction && statusCode >= 500 && !normalizedError.isOperational
    ? 'Terjadi kesalahan pada server.'
    : normalizedError.message;
  const shouldExposeStack = !isProduction && statusCode >= 500 && !normalizedError.isOperational;
  const shouldLogError = !isProduction && statusCode >= 500;

  if (shouldLogError) {
    console.error(error);
  }

  if (normalizedError.redirectTo) {
    if (typeof req.flash === 'function') {
      req.flash(normalizedError.flashType, message);
    }
    return res.redirect(normalizedError.redirectTo);
  }

  if (wantsJson(req)) {
    const payload = {
      status: statusCode >= 500 ? 'error' : 'fail',
      message,
    };

    if (shouldExposeStack) {
      payload.stack = normalizedError.stack;
    }

    return res.status(statusCode).json(payload);
  }

  const viewName = statusCode === 404 ? 'errors/404' : 'errors/error';

  return res.status(statusCode).render(viewName, {
    pageTitle: statusCode === 404 ? 'Page Not Found' : 'Something Went Wrong',
    statusCode,
    message,
    backUrl: getDashboardPath(req.session?.user),
    user: req.session?.user || null,
    stack: shouldExposeStack ? normalizedError.stack : null,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
