const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

/**
 * Enhanced MongoDB/NoSQL injection protection
 * Detects and prevents various NoSQL injection patterns
 */
const advancedMongoSanitize = (req, res, next) => {
  try {
    // List of dangerous MongoDB operators and patterns
    const dangerousPatterns = [
      /\$where/i,
      /\$regex/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$gte/i,
      /\$lte/i,
      /\$in/i,
      /\$nin/i,
      /\$exists/i,
      /\$type/i,
      /\$mod/i,
      /\$size/i,
      /\$all/i,
      /\$elemMatch/i,
      /javascript:/i,
      /eval\(/i,
      /function\(/i
    ];

    // Function to recursively check for dangerous patterns
    const checkForDangerousPatterns = (obj, path = '') => {
      if (typeof obj === 'string') {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(obj)) {
            console.warn(`🚨 Dangerous NoSQL pattern detected: ${pattern} in "${obj}" at path: ${path} from IP: ${req.ip}`);
            throw new Error(`Potentially dangerous input detected`);
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          // Check key names for dangerous patterns
          for (const pattern of dangerousPatterns) {
            if (pattern.test(key)) {
              console.warn(`🚨 Dangerous NoSQL operator in key: ${key} from IP: ${req.ip}`);
              throw new Error(`Potentially dangerous input detected`);
            }
          }
          
          // Recursively check values
          checkForDangerousPatterns(obj[key], `${path}.${key}`);
        }
      }
    };

    // Check request body
    if (req.body) {
      checkForDangerousPatterns(req.body, 'body');
    }

    // Check query parameters
    if (req.query) {
      checkForDangerousPatterns(req.query, 'query');
    }

    // Check URL parameters
    if (req.params) {
      checkForDangerousPatterns(req.params, 'params');
    }

    next();
  } catch (error) {
    console.error('🚨 NoSQL injection attempt blocked:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      error: error.message
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid input data detected',
      error: 'INVALID_INPUT'
    });
  }
};

/**
 * Enhanced XSS protection with more comprehensive sanitization
 */
const enhancedXSSProtection = (req, res, next) => {
  try {
    // XSS configuration with stricter settings
    const xssOptions = {
      whiteList: {}, // Allow no HTML tags
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
      css: false,
      escapeHtml: (html) => {
        return html
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      }
    };

    // Additional dangerous patterns to check for
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*>/gi,
      /<link\b[^<]*>/gi,
      /<meta\b[^<]*>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /livescript:/gi,
      /data:text\/html/gi
    ];

    // Function to sanitize input recursively
    const sanitizeRecursive = (obj, path = '') => {
      if (typeof obj === 'string') {
        // Check for XSS patterns
        for (const pattern of xssPatterns) {
          if (pattern.test(obj)) {
            console.warn(`🚨 XSS pattern detected: ${pattern} in "${obj.substring(0, 100)}..." at path: ${path} from IP: ${req.ip}`);
          }
        }
        
        // Apply XSS sanitization
        return xss(obj, xssOptions);
      } else if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeRecursive(item, `${path}[${index}]`));
      } else if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const key in obj) {
          // Sanitize key names too
          const sanitizedKey = typeof key === 'string' ? xss(key, xssOptions) : key;
          sanitized[sanitizedKey] = sanitizeRecursive(obj[key], `${path}.${key}`);
        }
        return sanitized;
      }
      return obj;
    };

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeRecursive(req.body, 'body');
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeRecursive(req.query, 'query');
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeRecursive(req.params, 'params');
    }

    next();
  } catch (error) {
    console.error('XSS sanitization error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * Content Security Policy violation reporting
 */
const cspViolationReporter = (req, res, next) => {
  if (req.url === '/csp-report' && req.method === 'POST') {
    console.warn('🚨 CSP Violation Report:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      report: req.body
    });

    return res.status(204).end();
  }
  next();
};

/**
 * Legacy sanitizeInput function (kept for backward compatibility)
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Use enhanced XSS protection
    enhancedXSSProtection(req, res, next);
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * MongoDB injection protection (using express-mongo-sanitize)
 */
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`🚨 MongoDB injection attempt sanitized: ${key} from IP: ${req.ip}`);
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
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/mp3'];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, WebP images and WAV, MP3 audio files are allowed.'
      });
    }
    
    // Check file size (additional check)
    const maxSize = req.file.mimetype.startsWith('audio/') ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for audio, 5MB for images
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`
      });
    }
    
    // Log file upload
    console.log(`[FILE_UPLOAD] User ${req.user._id} uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);
  }
  
  next();
};

module.exports = {
  sanitizeInput,
  enhancedXSSProtection,
  advancedMongoSanitize,
  mongoSanitizeMiddleware,
  securityHeaders,
  securityLogger,
  validateFileUpload,
  cspViolationReporter
}; 