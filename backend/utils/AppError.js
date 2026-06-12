class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = options.isOperational !== false;
    this.redirectTo = options.redirectTo || null;
    this.flashType = options.flashType || 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
