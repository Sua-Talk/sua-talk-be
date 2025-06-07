const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireActiveAccount } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const systemMetrics = require('../utils/systemMetrics');
const alerting = require('../utils/alerting');

const router = express.Router();

// Rate limiting for monitoring endpoints
const monitoringLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute
  message: {
    success: false,
    message: 'Too many monitoring requests. Please try again in 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Apply rate limiting to all monitoring routes
router.use(monitoringLimiter);

/**
 * GET /api/monitoring/metrics
 * Get comprehensive system metrics
 */
router.get('/metrics', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    const metrics = await systemMetrics.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system metrics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/monitoring/health
 * Get detailed health status with system metrics
 */
router.get('/health', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    const healthStatus = await systemMetrics.getHealthStatus();
    
    res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve health status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/monitoring/alerts
 * Get alert statistics and current alert status
 */
router.get('/alerts', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    const alertStats = alerting.getAlertStats();
    
    res.json({
      success: true,
      data: alertStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert statistics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/monitoring/alerts/thresholds
 * Update alert thresholds (admin only)
 */
router.put('/alerts/thresholds', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    // Check if user is admin (you might want to add admin role checking)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to update alert thresholds',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid thresholds object provided',
        error: 'INVALID_THRESHOLDS'
      });
    }

    alerting.updateThresholds(thresholds);
    
    res.json({
      success: true,
      message: 'Alert thresholds updated successfully',
      data: {
        newThresholds: alerting.alertThresholds
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update alert thresholds',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/monitoring/performance
 * Get performance metrics summary
 */
router.get('/performance', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    const [metrics, alertStats] = await Promise.all([
      systemMetrics.getMetrics(),
      Promise.resolve(alerting.getAlertStats())
    ]);

    const performance = {
      cpu: {
        usage: metrics.cpu.usage,
        count: metrics.cpu.count,
        loadAverage: metrics.cpu.loadAverage
      },
      memory: {
        system: metrics.memory.system,
        process: metrics.memory.process
      },
      uptime: metrics.uptime,
      responseTime: {
        average: alertStats.averageResponseTime,
        slowRequests: alertStats.slowRequests,
        consecutive: alertStats.consecutiveSlowRequests
      },
      errors: {
        lastMinute: alertStats.errorsLastMinute,
        lastHour: alertStats.errorsLastHour
      },
      alerts: {
        lastHour: alertStats.alertsInLastHour
      }
    };

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/monitoring/system
 * Get basic system information
 */
router.get('/system', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    const systemInfo = systemMetrics.getSystemInfo();
    const uptime = systemMetrics.getUptime();
    
    res.json({
      success: true,
      data: {
        ...systemInfo,
        uptime
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system information',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/monitoring/test-alert
 * Test alert system (admin only, development environment)
 */
router.post('/test-alert', authenticate, requireActiveAccount, asyncHandler(async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'Alert testing only available in development environment',
        error: 'NOT_ALLOWED_IN_PRODUCTION'
      });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to test alerts',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { alertType = 'TEST_ALERT', severity = 'WARNING' } = req.body;

    // Trigger a test alert
    alerting.triggerAlert(alertType, {
      testData: 'This is a test alert triggered manually',
      triggeredBy: req.user.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Test alert triggered successfully',
      data: {
        alertType,
        severity,
        triggeredBy: req.user.email
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger test alert',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

module.exports = router; 