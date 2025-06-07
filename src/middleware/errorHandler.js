const { validationResult } = require('express-validator');

/**
 * Centralized validation error handler middleware
 * Processes express-validator errors and returns consistent format
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Centralized application error handler
 * Handles all types of application errors with consistent format
 */
const handleApplicationError = (error, req, res, next) => {
  console.error('🚨 Application Error:', {
    url: req.url,
    method: req.method,
    user: req.user?.id,
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';
  let errorDetails = {};

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
    
    if (error.errors) {
      errorDetails.validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value
      }));
    }
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${error.path}: '${error.value}' is not a valid ${error.kind}`;
    errorCode = 'INVALID_ID';
    errorDetails.field = error.path;
    errorDetails.value = error.value;
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry detected';
    errorCode = 'DUPLICATE_ENTRY';
    
    const field = Object.keys(error.keyPattern || {})[0];
    const value = error.keyValue?.[field];
    
    if (field) {
      message = `${field} '${value}' already exists`;
      errorDetails.field = field;
      errorDetails.value = value;
    }
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorCode = 'EXPIRED_TOKEN';
  }

  if (error.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'FILE_UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB.';
        errorCode = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Only one file is allowed.';
        errorCode = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name. Use "photo" as the field name.';
        errorCode = 'UNEXPECTED_FIELD';
        break;
      default:
        message = 'File upload error: ' + error.message;
    }
  }

  // Custom application errors
  if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.code || 'APPLICATION_ERROR';
  }

  // Construct response
  const response = {
    success: false,
    message,
    error: errorCode,
    timestamp: new Date().toISOString(),
    ...errorDetails
  };

  // Add debug information in development
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalError: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler for unmatched routes
 */
const handleNotFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    error: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    availableRoutes: {
      auth: '/api/auth/*',
      users: '/api/users/*',
      babies: '/api/babies/*'
    }
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch and forward errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Success response helper
 * Standardizes success responses across the application
 */
const sendSuccessResponse = (res, statusCode = 200, message, data = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response helper
 * Standardizes error responses across the application
 */
const sendErrorResponse = (res, statusCode = 500, message, errorCode = 'ERROR', details = {}) => {
  const response = {
    success: false,
    message,
    error: errorCode,
    timestamp: new Date().toISOString(),
    ...details
  };

  return res.status(statusCode).json(response);
};

/**
 * Rate limit error handler
 * Custom handler for rate limiting errors
 */
const handleRateLimitError = (req, res) => {
  return res.status(429).json({
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  handleValidationErrors,
  handleApplicationError,
  handleNotFound,
  handleRateLimitError,
  asyncHandler,
  sendSuccessResponse,
  sendErrorResponse
}; 