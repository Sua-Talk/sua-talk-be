const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = xss(req.body[key]);
        }
      }
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = xss(req.query[key]);
        }
      }
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      for (const key in req.params) {
        if (typeof req.params[key] === 'string') {
          req.params[key] = xss(req.params[key]);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * MongoDB injection protection
 */
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Potential MongoDB injection attempt detected: ${key} from IP: ${req.ip}`);
  }
});

/**
 * Additional security headers (complementing Helmet.js)
 */
const securityHeaders = (req, res, next) => {
  // API-specific security headers
  res.setHeader('X-API-Version', '1.0.0');
  
  // Cache control for API responses
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // HTTPS enforcement header (in addition to HSTS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Cross-Origin-Resource-Policy for enhanced security
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  // Server information hiding
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

/**
 * Request logging for security monitoring
 */
const securityLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = (req.headers && req.headers['user-agent']) || 'Unknown';
  const userId = req.user ? req.user._id : 'Anonymous';
  const originalUrl = req.originalUrl || req.url || 'unknown';
  
  console.log(`[${timestamp}] ${req.method} ${originalUrl} - User: ${userId} - IP: ${req.ip} - UA: ${userAgent}`);
  
  // Log sensitive operations
  if (req.method === 'DELETE' || originalUrl.includes('upload') || originalUrl.includes('password')) {
    console.log(`[SECURITY] Sensitive operation: ${req.method} ${originalUrl} - User: ${userId} - IP: ${req.ip}`);
  }
  
  next();
};

/**
 * File upload security validation
 */
const validateFileUpload = (req, res, next) => {
  if (req.file) {
    // Additional file validation
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }
    
    // Check file size (additional check)
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    
    // Log file upload
    console.log(`[FILE_UPLOAD] User ${req.user._id} uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);
  }
  
  next();
};

module.exports = {
  sanitizeInput,
  mongoSanitizeMiddleware,
  securityHeaders,
  securityLogger,
  validateFileUpload
}; 