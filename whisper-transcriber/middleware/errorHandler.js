const logger = require('../utils/logger');
const config = require('../config');

/**
 * Global error handling middleware
 */

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  let error = err;

  // Handle non-AppError instances
  if (!(err instanceof AppError)) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    error = new AppError(message, statusCode, false);
  }

  // Log error
  logger.error('Request error', {
    statusCode: error.statusCode,
    message: error.message,
    stack: config.isDevelopment() ? error.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Send error response
  const response = {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode
    }
  };

  // Include stack trace in development
  if (config.isDevelopment()) {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
