const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT Configuration
const JWT_CONFIG = {
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d'
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  }
};

// Warn if using default secrets in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.warn('⚠️ WARNING: Using default JWT secrets in production. Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
  }
}

/**
 * Generate JWT Access Token
 * @param {Object} payload - User data to include in token
 * @param {Object} options - Additional options for token generation
 * @returns {String} JWT access token
 */
const generateAccessToken = (payload, options = {}) => {
  const tokenPayload = {
    userId: payload.userId || payload._id,
    email: payload.email,
    isEmailVerified: payload.isEmailVerified,
    type: 'access'
  };

  const tokenOptions = {
    expiresIn: options.expiresIn || JWT_CONFIG.accessToken.expiresIn,
    issuer: process.env.JWT_ISSUER || 'suatalk-api',
    audience: process.env.JWT_AUDIENCE || 'suatalk-app',
    ...options
  };

  return jwt.sign(tokenPayload, JWT_CONFIG.accessToken.secret, tokenOptions);
};

/**
 * Generate JWT Refresh Token
 * @param {Object} payload - User data to include in token
 * @param {Object} options - Additional options for token generation
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (payload, options = {}) => {
  const tokenPayload = {
    userId: payload.userId || payload._id,
    email: payload.email,
    type: 'refresh',
    tokenId: crypto.randomBytes(16).toString('hex') // Unique identifier for this token
  };

  const tokenOptions = {
    expiresIn: options.expiresIn || JWT_CONFIG.refreshToken.expiresIn,
    issuer: process.env.JWT_ISSUER || 'suatalk-api',
    audience: process.env.JWT_AUDIENCE || 'suatalk-app',
    ...options
  };

  return jwt.sign(tokenPayload, JWT_CONFIG.refreshToken.secret, tokenOptions);
};

/**
 * Verify JWT Access Token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload or null if invalid
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.accessToken.secret, {
      issuer: process.env.JWT_ISSUER || 'suatalk-api',
      audience: process.env.JWT_AUDIENCE || 'suatalk-app'
    });

    // Verify token type
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return {
      success: true,
      decoded,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      decoded: null,
      error: error.message
    };
  }
};

/**
 * Verify JWT Refresh Token
 * @param {String} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload or null if invalid
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.refreshToken.secret, {
      issuer: process.env.JWT_ISSUER || 'suatalk-api',
      audience: process.env.JWT_AUDIENCE || 'suatalk-app'
    });

    // Verify token type
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return {
      success: true,
      decoded,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      decoded: null,
      error: error.message
    };
  }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} Object containing both tokens
 */
const generateTokenPair = (user, options = {}) => {
  const accessToken = generateAccessToken(user, options.access);
  const refreshToken = generateRefreshToken(user, options.refresh);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: options.access?.expiresIn || JWT_CONFIG.accessToken.expiresIn
  };
};

/**
 * Decode JWT token without verification (for debugging)
 * @param {String} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    return null;
  }
};

/**
 * Get token expiration time
 * @param {String} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
const getTokenExpiration = (token) => {
  const decoded = decodeToken(token);
  if (decoded && decoded.payload && decoded.payload.exp) {
    return new Date(decoded.payload.exp * 1000);
  }
  return null;
};

/**
 * Check if token is expired
 * @param {String} token - JWT token
 * @returns {Boolean} True if expired, false otherwise
 */
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return true;
  return new Date() > expiration;
};

/**
 * Extract token from Authorization header
 * @param {String} authHeader - Authorization header value
 * @returns {String|null} Token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Create token response object
 * @param {Object} tokens - Token pair object
 * @param {Object} user - User object
 * @returns {Object} Formatted token response
 */
const createTokenResponse = (tokens, user) => {
  return {
    success: true,
    message: 'Authentication successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        isEmailVerified: user.isEmailVerified
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn
      }
    }
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  decodeToken,
  getTokenExpiration,
  isTokenExpired,
  extractTokenFromHeader,
  createTokenResponse
}; 