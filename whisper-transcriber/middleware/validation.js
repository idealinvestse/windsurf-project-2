const config = require('../config');
const { AppError } = require('./errorHandler');
const fs = require('fs');

/**
 * Validation middleware
 */

/**
 * Validate file upload
 */
function validateFileUpload(req, res, next) {
  if (!req.file) {
    return next(new AppError('No audio file provided', 400));
  }

  const { file } = req;

  // Validate file size
  if (file.size > config.uploads.maxSize) {
    // Clean up the file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return next(new AppError(
      `File too large. Maximum size is ${config.uploads.maxSize / (1024 * 1024)}MB`,
      413
    ));
  }

  // Validate MIME type
  if (!config.uploads.allowedMimeTypes.includes(file.mimetype)) {
    // Clean up the file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return next(new AppError(
      'Invalid file type. Please upload an audio file',
      400
    ));
  }

  next();
}

/**
 * Validate request body has required fields
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return next(new AppError(
        `Missing required fields: ${missing.join(', ')}`,
        400
      ));
    }
    
    next();
  };
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename) {
  if (!filename) {
    return null;
  }
  
  // Remove directory traversal attempts
  return filename
    .replace(/[\\\/]/g, '_')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim() || `file_${Date.now()}`;
}

module.exports = {
  validateFileUpload,
  validateRequired,
  sanitizeFilename
};
