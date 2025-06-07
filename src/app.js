const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { connectDB, checkDBHealth } = require('./config/database');
const { databaseErrorMiddleware } = require('./utils/dbErrorHandler');
const { handleApplicationError, handleNotFound } = require('./middleware/errorHandler');
const passport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const babyRoutes = require('./routes/babyRoutes');
const audioRoutes = require('./routes/audioRoutes');
const mlRoutes = require('./routes/mlRoutes');
const { 
  mongoSanitizeMiddleware, 
  securityHeaders, 
  enhancedXSSProtection, 
  advancedMongoSanitize,
  cspViolationReporter 
} = require('./middleware/security');
const { secureFileAccess, logFileAccess, fileDownloadRateLimit, streamFile } = require('./middleware/fileAccess');
const { authenticate } = require('./middleware/auth');
const { corsMiddleware, corsErrorHandler, logCorsConfig } = require('./middleware/corsConfig');
const {
  httpLogger,
  securityAuditLogger,
  performanceLogger,
  requestIdMiddleware,
  authFailureLogger,
  logStartup
} = require('./middleware/logging');
const jobManager = require('./jobs/jobManager');
require('dotenv').config();

const app = express();

// Request ID for tracing (first middleware)
app.use(requestIdMiddleware);

// HTTP request logging
app.use(httpLogger);

// Performance monitoring
app.use(performanceLogger);

// Security audit logging
app.use(securityAuditLogger);

// Authentication failure logging
app.use(authFailureLogger);

// Security middleware with enhanced configuration
app.use(helmet({
  // Strict Transport Security (HSTS) - Force HTTPS in production
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for API
  // Permissions Policy (Feature Policy)
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    bluetooth: []
  },
  // Additional security headers
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  ieNoOpen: true,
  hidePoweredBy: true
}));
app.use(securityHeaders);

// Enhanced security middleware - order matters!
app.use(advancedMongoSanitize);
app.use(mongoSanitizeMiddleware);
app.use(enhancedXSSProtection);

// CSP violation reporting endpoint
app.use(cspViolationReporter);

// Enhanced CORS configuration
app.use(corsMiddleware);

// Session configuration (needed for OAuth flow)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
    maxAge: 10 * 60 * 1000 // 10 minutes
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Secure static file serving for uploads with authentication and authorization
app.use('/uploads', 
  fileDownloadRateLimit,
  logFileAccess,
  authenticate,
  secureFileAccess,
  streamFile
);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await checkDBHealth();
  const jobStats = await jobManager.getJobStats();
  
  res.json({
    status: dbHealth.state ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    database: dbHealth,
    jobs: jobStats
  });
});

// Basic API root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SuaTalk Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/auth',
      users: '/users',
      babies: '/babies',
      audio: '/audio',
      ml: '/ml'
    }
  });
});

// Authentication routes
app.use('/auth', authRoutes);

// User routes
app.use('/users', userRoutes);

// Baby routes
app.use('/babies', babyRoutes);

// Audio routes
app.use('/audio', audioRoutes);

// ML routes
app.use('/ml', mlRoutes);

// CORS error handling middleware
app.use(corsErrorHandler);

// Database error handling middleware
app.use(databaseErrorMiddleware);

// Application error handling middleware
app.use(handleApplicationError);

// 404 handler for unmatched routes
app.use('*', handleNotFound);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  // Initialize database connection before starting server
  connectDB().then(async () => {
    // Initialize job manager
    await jobManager.initialize();
    await jobManager.scheduleCleanupJob();
    
    app.listen(PORT, () => {
      console.log(`🚀 SuaTalk Backend API running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/auth`);
      console.log(`🤖 Background jobs: enabled`);
      
      // Initialize logging system
      logStartup();
      
      // Log CORS configuration
      logCorsConfig();
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      await jobManager.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      await jobManager.shutdown();
      process.exit(0);
    });

  }).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = app; 