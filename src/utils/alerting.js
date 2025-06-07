const { logger } = require('../middleware/logging');

/**
 * Alerting System
 * Handles notifications for critical errors and system issues
 */
class AlertingSystem {
  constructor() {
    this.alertHistory = new Map();
    this.alertThresholds = {
      errorRate: {
        warning: 10, // 10 errors per minute
        critical: 25, // 25 errors per minute
        window: 60 * 1000 // 1 minute window
      },
      responseTime: {
        warning: 2000, // 2 seconds
        critical: 5000, // 5 seconds
        consecutiveHits: 5
      },
      systemHealth: {
        cpu: { warning: 75, critical: 90 },
        memory: { warning: 85, critical: 95 },
        disk: { warning: 85, critical: 95 }
      }
    };
    
    // Track metrics for alerting
    this.metrics = {
      errors: [],
      responseTimes: [],
      slowRequests: 0,
      consecutiveSlowRequests: 0
    };

    // Cooldown to prevent spam alerts (5 minutes)
    this.alertCooldown = 5 * 60 * 1000;
  }

  /**
   * Record an error for monitoring
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context (req, res, etc.)
   */
  recordError(error, context = {}) {
    const errorRecord = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      url: context.url,
      method: context.method,
      userId: context.userId,
      statusCode: context.statusCode
    };

    this.metrics.errors.push(errorRecord);
    this.cleanupOldMetrics();

    // Check if we should alert
    this.checkErrorRateThresholds();

    // Log the error
    logger.error('Application Error Recorded for Alerting', {
      type: 'ERROR_MONITORING',
      ...errorRecord
    });
  }

  /**
   * Record response time for monitoring
   * @param {number} responseTime - Response time in milliseconds
   * @param {Object} context - Request context
   */
  recordResponseTime(responseTime, context = {}) {
    this.metrics.responseTimes.push({
      timestamp: Date.now(),
      responseTime,
      url: context.url,
      method: context.method
    });

    // Check for slow requests
    if (responseTime > this.alertThresholds.responseTime.warning) {
      this.metrics.slowRequests++;
      this.metrics.consecutiveSlowRequests++;
      
      if (responseTime > this.alertThresholds.responseTime.critical) {
        this.triggerAlert('CRITICAL_RESPONSE_TIME', {
          responseTime,
          url: context.url,
          method: context.method,
          threshold: this.alertThresholds.responseTime.critical
        });
      }
      
      // Check for consecutive slow requests
      if (this.metrics.consecutiveSlowRequests >= this.alertThresholds.responseTime.consecutiveHits) {
        this.triggerAlert('CONSECUTIVE_SLOW_RESPONSES', {
          consecutiveCount: this.metrics.consecutiveSlowRequests,
          threshold: this.alertThresholds.responseTime.consecutiveHits,
          averageResponseTime: this.getAverageResponseTime()
        });
      }
    } else {
      this.metrics.consecutiveSlowRequests = 0; // Reset counter
    }

    this.cleanupOldMetrics();
  }

  /**
   * Check error rate thresholds and trigger alerts if needed
   */
  checkErrorRateThresholds() {
    const now = Date.now();
    const windowStart = now - this.alertThresholds.errorRate.window;
    const recentErrors = this.metrics.errors.filter(error => error.timestamp > windowStart);
    
    const errorCount = recentErrors.length;
    
    if (errorCount >= this.alertThresholds.errorRate.critical) {
      this.triggerAlert('CRITICAL_ERROR_RATE', {
        errorCount,
        timeWindow: this.alertThresholds.errorRate.window / 1000,
        threshold: this.alertThresholds.errorRate.critical,
        recentErrors: recentErrors.slice(-5) // Last 5 errors
      });
    } else if (errorCount >= this.alertThresholds.errorRate.warning) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        errorCount,
        timeWindow: this.alertThresholds.errorRate.window / 1000,
        threshold: this.alertThresholds.errorRate.warning
      });
    }
  }

  /**
   * Check system health metrics and trigger alerts
   * @param {Object} systemMetrics - System metrics from systemMetrics.js
   */
  checkSystemHealth(systemMetrics) {
    const { cpu, memory, disk } = systemMetrics;

    // CPU alerts
    if (cpu.usage >= this.alertThresholds.systemHealth.cpu.critical) {
      this.triggerAlert('CRITICAL_CPU_USAGE', {
        usage: cpu.usage,
        threshold: this.alertThresholds.systemHealth.cpu.critical,
        loadAverage: cpu.loadAverage
      });
    } else if (cpu.usage >= this.alertThresholds.systemHealth.cpu.warning) {
      this.triggerAlert('HIGH_CPU_USAGE', {
        usage: cpu.usage,
        threshold: this.alertThresholds.systemHealth.cpu.warning
      });
    }

    // Memory alerts
    if (memory.system.usagePercent >= this.alertThresholds.systemHealth.memory.critical) {
      this.triggerAlert('CRITICAL_MEMORY_USAGE', {
        usage: memory.system.usagePercent,
        threshold: this.alertThresholds.systemHealth.memory.critical,
        available: memory.system.free,
        processMemory: memory.process
      });
    } else if (memory.system.usagePercent >= this.alertThresholds.systemHealth.memory.warning) {
      this.triggerAlert('HIGH_MEMORY_USAGE', {
        usage: memory.system.usagePercent,
        threshold: this.alertThresholds.systemHealth.memory.warning,
        available: memory.system.free
      });
    }

    // Disk alerts
    if (disk.usagePercent && disk.usagePercent >= this.alertThresholds.systemHealth.disk.critical) {
      this.triggerAlert('CRITICAL_DISK_USAGE', {
        usage: disk.usagePercent,
        threshold: this.alertThresholds.systemHealth.disk.critical,
        available: disk.available,
        total: disk.total
      });
    } else if (disk.usagePercent && disk.usagePercent >= this.alertThresholds.systemHealth.disk.warning) {
      this.triggerAlert('HIGH_DISK_USAGE', {
        usage: disk.usagePercent,
        threshold: this.alertThresholds.systemHealth.disk.warning,
        available: disk.available
      });
    }
  }

  /**
   * Trigger an alert
   * @param {string} alertType - Type of alert
   * @param {Object} data - Alert data
   */
  triggerAlert(alertType, data) {
    const alertKey = `${alertType}:${JSON.stringify(data)}`;
    const now = Date.now();

    // Check cooldown to prevent spam
    if (this.alertHistory.has(alertKey)) {
      const lastAlert = this.alertHistory.get(alertKey);
      if (now - lastAlert < this.alertCooldown) {
        return; // Skip this alert due to cooldown
      }
    }

    // Record the alert
    this.alertHistory.set(alertKey, now);

    const alert = {
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      timestamp: new Date().toISOString(),
      data,
      environment: process.env.NODE_ENV || 'development',
      hostname: require('os').hostname(),
      service: 'suatalk-api'
    };

    // Log the alert
    logger.error('SYSTEM ALERT TRIGGERED', {
      type: 'SYSTEM_ALERT',
      alert
    });

    // Send notifications based on severity and environment
    this.sendNotification(alert);

    // Clean up old alert history
    this.cleanupAlertHistory();
  }

  /**
   * Send notification for alert
   * @param {Object} alert - Alert object
   */
  async sendNotification(alert) {
    try {
      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.error(`🚨 [${alert.severity}] ${alert.type}:`, alert.data);
        return;
      }

      // In production, you might want to integrate with:
      // - Email notifications
      // - Slack/Discord webhooks
      // - PagerDuty
      // - SMS alerts
      // - External monitoring services

      // Example: Send to webhook if configured
      if (process.env.ALERT_WEBHOOK_URL) {
        await this.sendWebhookNotification(alert);
      }

      // Example: Send email for critical alerts
      if (alert.severity === 'CRITICAL' && process.env.ALERT_EMAIL) {
        await this.sendEmailAlert(alert);
      }

    } catch (error) {
      logger.error('Failed to send alert notification', {
        type: 'NOTIFICATION_ERROR',
        error: error.message,
        alert
      });
    }
  }

  /**
   * Send webhook notification
   * @param {Object} alert - Alert object
   */
  async sendWebhookNotification(alert) {
    try {
      const axios = require('axios');
      
      const payload = {
        text: `🚨 ${alert.severity} Alert: ${alert.type}`,
        embeds: [{
          title: `${alert.type}`,
          color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
          fields: [
            { name: 'Severity', value: alert.severity, short: true },
            { name: 'Environment', value: alert.environment, short: true },
            { name: 'Hostname', value: alert.hostname, short: true },
            { name: 'Timestamp', value: alert.timestamp, short: true },
            { name: 'Details', value: JSON.stringify(alert.data, null, 2), short: false }
          ]
        }]
      };

      await axios.post(process.env.ALERT_WEBHOOK_URL, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      logger.info('Webhook alert sent successfully', {
        type: 'WEBHOOK_NOTIFICATION',
        alertType: alert.type
      });

    } catch (error) {
      logger.error('Failed to send webhook notification', {
        type: 'WEBHOOK_ERROR',
        error: error.message
      });
    }
  }

  /**
   * Send email alert (placeholder for email integration)
   * @param {Object} alert - Alert object
   */
  async sendEmailAlert(alert) {
    // Placeholder for email integration
    // You would integrate with your email service here
    logger.info('Email alert would be sent', {
      type: 'EMAIL_NOTIFICATION',
      alert
    });
  }

  /**
   * Get alert severity based on alert type
   * @param {string} alertType - Type of alert
   * @returns {string} Severity level
   */
  getAlertSeverity(alertType) {
    const criticalTypes = [
      'CRITICAL_ERROR_RATE',
      'CRITICAL_RESPONSE_TIME',
      'CRITICAL_CPU_USAGE',
      'CRITICAL_MEMORY_USAGE',
      'CRITICAL_DISK_USAGE'
    ];

    return criticalTypes.includes(alertType) ? 'CRITICAL' : 'WARNING';
  }

  /**
   * Get average response time from recent metrics
   * @returns {number} Average response time in milliseconds
   */
  getAverageResponseTime() {
    if (this.metrics.responseTimes.length === 0) return 0;
    
    const total = this.metrics.responseTimes.reduce((sum, metric) => sum + metric.responseTime, 0);
    return Math.round(total / this.metrics.responseTimes.length);
  }

  /**
   * Clean up old metrics to prevent memory issues
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // Keep 30 minutes of data

    this.metrics.errors = this.metrics.errors.filter(error => now - error.timestamp < maxAge);
    this.metrics.responseTimes = this.metrics.responseTimes.filter(metric => now - metric.timestamp < maxAge);
  }

  /**
   * Clean up old alert history
   */
  cleanupAlertHistory() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // Keep 1 hour of alert history

    for (const [key, timestamp] of this.alertHistory.entries()) {
      if (now - timestamp > maxAge) {
        this.alertHistory.delete(key);
      }
    }
  }

  /**
   * Get current alert statistics
   * @returns {Object} Alert statistics
   */
  getAlertStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const lastMinute = now - (60 * 1000);

    return {
      errorsLastMinute: this.metrics.errors.filter(e => e.timestamp > lastMinute).length,
      errorsLastHour: this.metrics.errors.filter(e => e.timestamp > lastHour).length,
      averageResponseTime: this.getAverageResponseTime(),
      slowRequests: this.metrics.slowRequests,
      consecutiveSlowRequests: this.metrics.consecutiveSlowRequests,
      alertsInLastHour: Array.from(this.alertHistory.values()).filter(timestamp => timestamp > lastHour).length,
      thresholds: this.alertThresholds
    };
  }

  /**
   * Update alert thresholds
   * @param {Object} newThresholds - New threshold configuration
   */
  updateThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    
    logger.info('Alert thresholds updated', {
      type: 'THRESHOLD_UPDATE',
      newThresholds: this.alertThresholds
    });
  }
}

// Export singleton instance
module.exports = new AlertingSystem(); 