const APIKey = require('../models/APIKey');
const rateLimit = require('express-rate-limit');
const { promisify } = require('util');

// Cache for API keys to reduce database queries
const apiKeyCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, { timestamp }] of apiKeyCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      apiKeyCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

/**
 * Extract API key from request headers
 */
const extractAPIKey = (req) => {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Check query parameter (less secure, for development only)
  if (process.env.NODE_ENV === 'development' && req.query.api_key) {
    return req.query.api_key;
  }
  
  return null;
};

/**
 * Get client IP address
 */
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
};

/**
 * Validate API key and attach to request
 */
const validateAPIKey = async (req, res, next) => {
  try {
    const apiKey = extractAPIKey(req);
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required',
        error: 'MISSING_API_KEY'
      });
    }
    
    // Check cache first
    const cacheKey = APIKey.hashKey(apiKey);
    let apiKeyDoc = null;
    
    if (apiKeyCache.has(cacheKey)) {
      const cached = apiKeyCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        apiKeyDoc = cached.data;
      } else {
        apiKeyCache.delete(cacheKey);
      }
    }
    
    // If not in cache, query database
    if (!apiKeyDoc) {
      apiKeyDoc = await APIKey.findOne({
        keyHash: cacheKey,
        isActive: true
      }).populate('createdBy', 'email name');
      
      if (!apiKeyDoc) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key',
          error: 'INVALID_API_KEY'
        });
      }
      
      // Cache the result
      apiKeyCache.set(cacheKey, {
        data: apiKeyDoc,
        timestamp: Date.now()
      });
    }
    
    // Check if API key is expired
    if (apiKeyDoc.isExpired()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired',
        error: 'EXPIRED_API_KEY'
      });
    }
    
    // Check IP restrictions
    const clientIP = getClientIP(req);
    if (!apiKeyDoc.isIPAllowed(clientIP)) {
      return res.status(403).json({
        success: false,
        message: 'IP address not allowed for this API key',
        error: 'IP_NOT_ALLOWED',
        clientIP
      });
    }
    
    // Attach API key to request
    req.apiKey = apiKeyDoc;
    req.apiKeyString = apiKey;
    
    // Record usage (async, don't wait)
    apiKeyDoc.recordUsage().catch(err => {
      console.error('Error recording API key usage:', err);
    });
    
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during API key validation',
      error: 'API_KEY_VALIDATION_ERROR'
    });
  }
};

/**
 * Check if API key has required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required',
        error: 'MISSING_API_KEY'
      });
    }
    
    if (!req.apiKey.hasPermission(permission)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${permission}`,
        error: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        available: req.apiKey.permissions
      });
    }
    
    next();
  };
};

/**
 * Create rate limiter for API keys
 */
const createAPIKeyRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req) => {
      if (req.apiKey) {
        return req.apiKey.rateLimitPerHour;
      }
      return 100; // Default for non-API key requests
    },
    keyGenerator: (req) => {
      if (req.apiKey) {
        return `apikey:${req.apiKey._id}`;
      }
      return req.ip;
    },
    message: (req) => ({
      success: false,
      message: 'API key rate limit exceeded',
      error: 'RATE_LIMIT_EXCEEDED',
      limit: req.apiKey ? req.apiKey.rateLimitPerHour : 100,
      window: '1 hour',
      retryAfter: Math.ceil(options.windowMs / 1000)
    }),
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };
  
  return rateLimit(defaultOptions);
};

/**
 * Middleware to require API key authentication
 */
const requireAPIKey = [validateAPIKey];

/**
 * Optional API key middleware (doesn't fail if no API key provided)
 */
const optionalAPIKey = async (req, res, next) => {
  const apiKey = extractAPIKey(req);
  
  if (apiKey) {
    return validateAPIKey(req, res, next);
  }
  
  next();
};

/**
 * Combine JWT auth with API key auth (either one is sufficient)
 */
const hybridAuth = (jwtMiddleware) => {
  return async (req, res, next) => {
    const apiKey = extractAPIKey(req);
    const hasJWT = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') && !apiKey;
    
    if (apiKey) {
      // Use API key authentication
      return validateAPIKey(req, res, next);
    } else if (hasJWT) {
      // Use JWT authentication
      return jwtMiddleware(req, res, next);
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Provide either API key or JWT token.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }
  };
};

module.exports = {
  validateAPIKey,
  requirePermission,
  createAPIKeyRateLimit,
  requireAPIKey,
  optionalAPIKey,
  hybridAuth,
  extractAPIKey,
  getClientIP
}; 