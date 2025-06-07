const cors = require('cors');

// Environment-specific allowed origins
const getAllowedOrigins = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base origins from environment variables
  const origins = [];
  
  if (isDevelopment) {
    // Development origins
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    );
    
    // Custom development frontend URL
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }
  }
  
  if (isProduction) {
    // Production origins
    origins.push(
      'https://suatalk.site',
      'https://www.suatalk.site'
    );
    
    // Custom production frontend URL
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }
  }
  
  // Additional origins from environment variable (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    origins.push(...additionalOrigins);
  }
  
  return origins;
};

// Dynamic origin validation function
const originValidator = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();
  
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check if the origin is in the allowed list
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // Log unauthorized origin attempts
  console.warn(`🚫 Blocked CORS request from unauthorized origin: ${origin}`);
  return callback(new Error('Not allowed by CORS policy'), false);
};

// Enhanced CORS configuration
const corsConfig = {
  // Dynamic origin validation
  origin: originValidator,
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Allowed request headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],
  
  // Exposed response headers (visible to the client)
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-API-Version'
  ],
  
  // Preflight cache duration (24 hours)
  maxAge: 86400,
  
  // Disable preflight for simple requests
  preflightContinue: false,
  
  // Success status for OPTIONS requests
  optionsSuccessStatus: 204
};

// Create CORS middleware
const corsMiddleware = cors(corsConfig);

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS policy') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation: Origin not allowed',
      error: 'CORS_ORIGIN_NOT_ALLOWED',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// Log CORS configuration on startup
const logCorsConfig = () => {
  const allowedOrigins = getAllowedOrigins();
  console.log('🌐 CORS Configuration:');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Allowed Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'None configured'}`);
  console.log(`   Credentials: ${corsConfig.credentials ? 'Enabled' : 'Disabled'}`);
  console.log(`   Methods: ${corsConfig.methods.join(', ')}`);
  console.log(`   Preflight Cache: ${corsConfig.maxAge / 3600} hours`);
};

module.exports = {
  corsMiddleware,
  corsErrorHandler,
  logCorsConfig,
  getAllowedOrigins
}; 