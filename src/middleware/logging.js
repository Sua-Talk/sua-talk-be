const morgan = require('morgan');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Winston logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'suatalk-api' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    })
  ]
};

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  // General application logs with rotation
  loggerConfig.transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    })
  );

  // Error logs with rotation
  loggerConfig.transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  );

  // Security audit logs with rotation
  loggerConfig.transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'warn'
    })
  );
}

// Create Winston logger instance
const logger = winston.createLogger(loggerConfig);

// Custom Morgan tokens
morgan.token('user-id', (req) => {
  return req.user ? req.user._id : 'anonymous';
});

morgan.token('request-id', (req) => {
  return req.id || 'unknown';
});

morgan.token('user-agent-short', (req) => {
  const userAgent = req.get('User-Agent') || '';
  return userAgent.split(' ')[0]; // Get first part (browser/app name)
});

morgan.token('response-time-colored', (req, res) => {
  const time = morgan['response-time'](req, res);
  const ms = parseFloat(time);
  if (ms < 100) return `\x1b[32m${time}ms\x1b[0m`; // Green
  if (ms < 500) return `\x1b[33m${time}ms\x1b[0m`; // Yellow
  return `\x1b[31m${time}ms\x1b[0m`; // Red
});

// Morgan format for development
const devFormat = ':method :url :status :response-time-colored - :user-id - :user-agent-short';

// Morgan format for production (JSON)
const prodFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  ip: ':remote-addr',
  userId: ':user-id',
  requestId: ':request-id',
  referrer: ':referrer'
});

// Create Morgan middleware
const httpLogger = morgan(
  process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  {
    stream: {
      write: (message) => {
        if (process.env.NODE_ENV === 'production') {
          try {
            const logData = JSON.parse(message.trim());
            logger.info('HTTP Request', logData);
          } catch (e) {
            logger.info(message.trim());
          }
        } else {
          // In development, let Morgan handle console output
          process.stdout.write(message);
        }
      }
    },
    skip: (req, res) => {
      // Skip logging for health checks and OPTIONS requests
      return req.url === '/health' || req.method === 'OPTIONS';
    }
  }
);

// Security audit logger for sensitive operations
const securityAuditLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // List of sensitive operations to log
  const sensitiveOperations = [
    'password', 'reset', 'delete', 'remove', 'admin', 'login', 'register',
    'upload', 'download', 'key', 'token', 'auth', 'oauth', 'verify'
  ];
  
  const isSensitive = sensitiveOperations.some(op => 
    req.url.toLowerCase().includes(op) || 
    req.method === 'DELETE' ||
    req.method === 'PATCH' && req.url.includes('/users/')
  );
  
  if (isSensitive) {
    const auditData = {
      type: 'SENSITIVE_OPERATION',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user ? req.user._id : null,
      userEmail: req.user ? req.user.email : null,
      headers: {
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP'),
        'authorization': req.get('Authorization') ? '[REDACTED]' : null,
        'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : null
      },
      body: req.method !== 'GET' ? sanitizeLogData(req.body) : null,
      query: Object.keys(req.query).length > 0 ? sanitizeLogData(req.query) : null
    };
    
    // Log immediately for sensitive operations
    logger.warn('Security Audit', auditData);
    
    // Also log the response when it's complete
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.warn('Security Audit Response', {
        ...auditData,
        responseStatus: res.statusCode,
        responseTime: `${responseTime}ms`,
        success: res.statusCode < 400
      });
    });
  }
  
  next();
};

// Performance monitoring logger
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      logger.warn('Slow Request', {
        type: 'PERFORMANCE',
        method: req.method,
        url: req.url,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        userId: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    // Log server errors
    if (res.statusCode >= 500) {
      logger.error('Server Error Response', {
        type: 'ERROR_RESPONSE',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.user ? req.user._id : null,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  });
  
  next();
};

// Request ID middleware for tracing
const requestIdMiddleware = (req, res, next) => {
  req.id = generateRequestId();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Failed authentication attempts logger
const authFailureLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this is an authentication failure
    if (res.statusCode === 401 || res.statusCode === 403) {
      const isAuthEndpoint = req.url.includes('/auth/') || 
                            req.url.includes('/login') || 
                            req.url.includes('/register');
      
      if (isAuthEndpoint) {
        logger.warn('Authentication Failure', {
          type: 'AUTH_FAILURE',
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          attemptedEmail: req.body?.email || null,
          failureReason: typeof data === 'string' ? data : JSON.stringify(data)
        });
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Utility functions
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log system startup
const logStartup = () => {
  logger.info('Logging System Initialized', {
    type: 'SYSTEM_STARTUP',
    environment: process.env.NODE_ENV || 'development',
    logLevel: loggerConfig.level,
    logsDirectory: process.env.NODE_ENV === 'production' ? logsDir : 'console-only',
    features: {
      httpLogging: true,
      securityAudit: true,
      performanceMonitoring: true,
      authFailureTracking: true,
      requestTracing: true,
      logRotation: process.env.NODE_ENV === 'production'
    }
  });
};

module.exports = {
  logger,
  httpLogger,
  securityAuditLogger,
  performanceLogger,
  requestIdMiddleware,
  authFailureLogger,
  logStartup
}; 