const passport = require('../config/passport');
const jwtService = require('../services/jwtService');

/**
 * Authentication middleware using Passport JWT strategy
 * Validates JWT token and attaches user to request object
 */
const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({
        error: true,
        message: 'Internal authentication error'
      });
    }

    if (!user) {
      const message = info?.message || 'Invalid or missing authentication token';
      return res.status(401).json({
        error: true,
        message,
        requiresAuthentication: true
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block request if invalid
 */
const optionalAuthenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Optional authentication error:', err);
    }

    // Attach user if authentication was successful, otherwise continue without user
    req.user = user || null;
    next();
  })(req, res, next);
};

/**
 * Role-based authorization middleware
 * Requires authentication first, then checks if user has required role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        error: true,
        message: 'Authentication required',
        requiresAuthentication: true
      });
    }

    // Check if user has any of the required roles
    const userRoles = req.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: true,
        message: 'Insufficient permissions',
        requiredRoles: roles,
        userRoles: userRoles
      });
    }

    next();
  };
};

/**
 * Email verification middleware
 * Ensures user's email is verified before allowing access
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required',
      requiresAuthentication: true
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      error: true,
      message: 'Email verification required',
      requiresEmailVerification: true
    });
  }

  next();
};

/**
 * Account status middleware
 * Ensures user account is active and not suspended
 */
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required',
      requiresAuthentication: true
    });
  }

  if (!req.user.isActive) {
    return res.status(403).json({
      error: true,
      message: 'Account has been deactivated. Please contact support.',
      accountDeactivated: true
    });
  }

  next();
};

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources (unless admin)
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: true,
        message: 'Authentication required',
        requiresAuthentication: true
      });
    }

    // Admin users can access any resource
    if (req.user.roles && req.user.roles.includes('admin')) {
      return next();
    }

    // Get resource user ID from request parameters, body, or route params
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        error: true,
        message: 'Resource owner identification required'
      });
    }

    // Check if user owns the resource
    if (req.user._id.toString() !== resourceUserId.toString()) {
      return res.status(403).json({
        error: true,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

/**
 * Rate limiting middleware based on user
 * Applies different rate limits based on user roles
 */
const userBasedRateLimit = (limits = {}) => {
  const defaultLimits = {
    admin: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes for admin
    user: { windowMs: 15 * 60 * 1000, max: 100 },   // 100 requests per 15 minutes for users
    guest: { windowMs: 15 * 60 * 1000, max: 20 }    // 20 requests per 15 minutes for guests
  };

  const rateLimits = { ...defaultLimits, ...limits };

  return (req, res, next) => {
    let userType = 'guest';

    if (req.user) {
      if (req.user.roles && req.user.roles.includes('admin')) {
        userType = 'admin';
      } else {
        userType = 'user';
      }
    }

    // This is a simplified rate limiting logic
    // In production, you'd want to use a proper rate limiting library like express-rate-limit
    // and store rate limit data in Redis or similar
    req.rateLimit = rateLimits[userType];
    next();
  };
};

/**
 * Combine multiple auth middleware
 * Helper function to easily combine authentication with other requirements
 */
const authWithRequirements = (...middlewares) => {
  return [authenticate, ...middlewares];
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireEmailVerification,
  requireActiveAccount,
  requireOwnership,
  userBasedRateLimit,
  authWithRequirements
}; 