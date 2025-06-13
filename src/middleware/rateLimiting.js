const rateLimit = require('express-rate-limit');

// General user profile rate limiting
const profileRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    success: false,
    message: 'Too many profile requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Avatar upload rate limiting (more restrictive)
const avatarUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 uploads per hour
  message: {
    success: false,
    message: 'Too many avatar uploads. Please try again in an hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Account deletion rate limiting (very restrictive)
const accountDeletionRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // 1 deletion attempt per day
  message: {
    success: false,
    message: 'Account deletion can only be attempted once per day. Please contact support if you need assistance.',
    retryAfter: '24 hours'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Profile update rate limiting
const profileUpdateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 updates per window
  message: {
    success: false,
    message: 'Too many profile updates. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Authentication rate limiting
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window per IP
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
    retryAfter: '15 minutes',
    error: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // Always use IP for login attempts
  skipSuccessfulRequests: true // Only count failed attempts
});

// Registration rate limiting (prevent spam accounts)
// In development, the limiter is disabled to streamline testing.
const registrationRateLimit =
  process.env.NODE_ENV === 'development'
    ? (req, _res, next) => next()
    : rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 registrations per hour per IP
        message: {
          success: false,
          message: 'Too many registration attempts. Please try again in an hour.',
          retryAfter: '1 hour',
          error: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip
      });

// Password reset rate limiting
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour per IP
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in an hour.',
    retryAfter: '1 hour',
    error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Email verification rate limiting
const emailVerificationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 verification attempts per 10 minutes per IP
  message: {
    success: false,
    message: 'Too many email verification attempts. Please try again later.',
    retryAfter: '10 minutes',
    error: 'EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// OAuth rate limiting (for Google auth)
const oauthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 OAuth attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many OAuth attempts. Please try again later.',
    retryAfter: '15 minutes',
    error: 'OAUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

module.exports = {
  profileRateLimit,
  avatarUploadRateLimit,
  accountDeletionRateLimit,
  profileUpdateRateLimit,
  loginRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  oauthRateLimit
}; 