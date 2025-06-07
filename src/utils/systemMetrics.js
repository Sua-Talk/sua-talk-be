const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * System Metrics Utility
 * Collects and provides system performance metrics
 */
class SystemMetrics {
  constructor() {
    this.startTime = Date.now();
    this.processStartTime = process.hrtime();
  }

  /**
   * Get CPU usage percentage
   * @returns {Promise<number>} CPU usage as percentage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const elapsedTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
        const totalCPUTime = endUsage.user + endUsage.system;
        const cpuPercent = (totalCPUTime / elapsedTime) * 100;

        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Get memory usage information
   * @returns {Object} Memory usage details
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    const usedSystemMem = total - free;

    return {
      process: {
        rss: Math.round(used.rss / 1024 / 1024), // MB
        heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
        external: Math.round(used.external / 1024 / 1024), // MB
        arrayBuffers: Math.round((used.arrayBuffers || 0) / 1024 / 1024) // MB
      },
      system: {
        total: Math.round(total / 1024 / 1024), // MB
        free: Math.round(free / 1024 / 1024), // MB
        used: Math.round(usedSystemMem / 1024 / 1024), // MB
        usagePercent: Math.round((usedSystemMem / total) * 100)
      }
    };
  }

  /**
   * Get disk usage for current directory
   * @returns {Promise<Object>} Disk usage information
   */
  async getDiskUsage() {
    try {
      const stats = await fs.stat(process.cwd());
      const statfs = await this.getFileSystemStats();
      
      return {
        available: statfs ? Math.round(statfs.free / 1024 / 1024) : null, // MB
        total: statfs ? Math.round(statfs.total / 1024 / 1024) : null, // MB
        used: statfs ? Math.round((statfs.total - statfs.free) / 1024 / 1024) : null, // MB
        usagePercent: statfs ? Math.round(((statfs.total - statfs.free) / statfs.total) * 100) : null
      };
    } catch (error) {
      return {
        available: null,
        total: null,
        used: null,
        usagePercent: null,
        error: error.message
      };
    }
  }

  /**
   * Get file system statistics (cross-platform)
   * @returns {Promise<Object|null>} File system stats or null
   */
  async getFileSystemStats() {
    try {
      // This is a simplified approach - in production you might want to use a library like 'diskusage'
      if (os.platform() === 'linux') {
        const statfs = require('util').promisify(require('fs').statSync);
        // For Linux, you'd typically use statvfs system call
        // This is a placeholder - consider using 'diskusage' npm package for accurate stats
        return null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get system uptime and process uptime
   * @returns {Object} Uptime information
   */
  getUptime() {
    const systemUptime = os.uptime();
    const processUptime = process.uptime();
    const serviceUptime = (Date.now() - this.startTime) / 1000;

    return {
      system: {
        seconds: systemUptime,
        formatted: this.formatUptime(systemUptime)
      },
      process: {
        seconds: processUptime,
        formatted: this.formatUptime(processUptime)
      },
      service: {
        seconds: serviceUptime,
        formatted: this.formatUptime(serviceUptime)
      }
    };
  }

  /**
   * Get system load average (Unix-like systems only)
   * @returns {Object} Load average information
   */
  getLoadAverage() {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    return {
      '1min': Math.round(loadAvg[0] * 100) / 100,
      '5min': Math.round(loadAvg[1] * 100) / 100,
      '15min': Math.round(loadAvg[2] * 100) / 100,
      cpuCount,
      normalized: {
        '1min': Math.round((loadAvg[0] / cpuCount) * 100) / 100,
        '5min': Math.round((loadAvg[1] / cpuCount) * 100) / 100,
        '15min': Math.round((loadAvg[2] / cpuCount) * 100) / 100
      }
    };
  }

  /**
   * Get system information
   * @returns {Object} System information
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      osType: os.type(),
      osRelease: os.release(),
      pid: process.pid,
      ppid: process.ppid || null
    };
  }

  /**
   * Get comprehensive system metrics
   * @returns {Promise<Object>} All system metrics
   */
  async getMetrics() {
    const [cpuUsage, diskUsage] = await Promise.all([
      this.getCPUUsage(),
      this.getDiskUsage()
    ]);

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        count: os.cpus().length,
        loadAverage: this.getLoadAverage()
      },
      memory: this.getMemoryUsage(),
      disk: diskUsage,
      uptime: this.getUptime(),
      system: this.getSystemInfo()
    };
  }

  /**
   * Check if system metrics indicate potential issues
   * @returns {Promise<Object>} Health status based on metrics
   */
  async getHealthStatus() {
    const metrics = await this.getMetrics();
    const warnings = [];
    const errors = [];

    // Check CPU usage
    if (metrics.cpu.usage > 90) {
      errors.push('High CPU usage detected');
    } else if (metrics.cpu.usage > 75) {
      warnings.push('Elevated CPU usage');
    }

    // Check memory usage
    if (metrics.memory.system.usagePercent > 95) {
      errors.push('Critical memory usage');
    } else if (metrics.memory.system.usagePercent > 85) {
      warnings.push('High memory usage');
    }

    // Check process memory usage
    if (metrics.memory.process.heapUsed > 500) { // 500MB threshold
      warnings.push('High process memory usage');
    }

    // Check disk usage
    if (metrics.disk.usagePercent && metrics.disk.usagePercent > 95) {
      errors.push('Critical disk space');
    } else if (metrics.disk.usagePercent && metrics.disk.usagePercent > 85) {
      warnings.push('Low disk space');
    }

    // Check load average (Unix-like systems)
    if (os.platform() !== 'win32') {
      if (metrics.cpu.loadAverage.normalized['1min'] > 2.0) {
        errors.push('Very high system load');
      } else if (metrics.cpu.loadAverage.normalized['1min'] > 1.5) {
        warnings.push('High system load');
      }
    }

    let status = 'healthy';
    if (errors.length > 0) {
      status = 'critical';
    } else if (warnings.length > 0) {
      status = 'warning';
    }

    return {
      status,
      warnings,
      errors,
      metrics,
      thresholds: {
        cpu: { warning: 75, critical: 90 },
        memory: { warning: 85, critical: 95 },
        disk: { warning: 85, critical: 95 },
        load: { warning: 1.5, critical: 2.0 }
      }
    };
  }

  /**
   * Format uptime in human readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}

// Export singleton instance
module.exports = new SystemMetrics(); 