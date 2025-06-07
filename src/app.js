const express = require('express');
const cors = require('cors');
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
const { mongoSanitizeMiddleware, securityHeaders } = require('./middleware/security');
const jobManager = require('./jobs/jobManager');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(mongoSanitizeMiddleware);

// CORS configuration for subdomain API
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://suatalk.site',
    'https://www.suatalk.site',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));

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

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

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