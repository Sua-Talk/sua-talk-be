const Queue = require('bull');
const redisManager = require('../config/redis');
const emailService = require('./emailService');

class EmailQueue {
  constructor() {
    this.queue = null;
    this.isInitialized = false;
    this.workers = [];
  }

  /**
   * Initialize the email queue
   */
  async initialize() {
    try {
      // Connect to Redis first
      await redisManager.connect();
      
      // Get Redis connection info for Bull
      const redisConfig = redisManager.getConnectionInfo();
      
      if (redisConfig.isConnected && redisManager.client) {
        // Use actual Redis connection
        this.queue = new Queue('email processing', {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: process.env.REDIS_DB || 0,
          },
          defaultJobOptions: {
            removeOnComplete: 50, // Keep last 50 completed jobs
            removeOnFail: 20,     // Keep last 20 failed jobs
            attempts: 3,          // Retry failed jobs 3 times
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });
      } else {
        // Fallback to memory queue (for development)
        console.log('📧 Using in-memory queue (Redis not available)');
        this.queue = new Queue('email processing', {
          redis: {
            host: 'localhost',
            port: 6379,
            // This will fallback to in-memory if Redis is not available
            lazyConnect: true,
            maxRetriesPerRequest: 1,
          },
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 2,
            backoff: {
              type: 'fixed',
              delay: 1000,
            },
          },
        });
      }

      // Set up event listeners
      this.setupEventListeners();

      // Set up workers
      this.setupWorkers();

      this.isInitialized = true;
      console.log('✅ Email queue initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize email queue:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Set up event listeners for the queue
   */
  setupEventListeners() {
    if (!this.queue) return;

    this.queue.on('completed', (job) => {
      console.log(`✅ Email job ${job.id} completed: ${job.data.type} to ${job.data.to}`);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`❌ Email job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`⚠️ Email job ${job.id} stalled`);
    });

    this.queue.on('progress', (job, progress) => {
      console.log(`📧 Email job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Set up workers to process different types of email jobs
   */
  setupWorkers() {
    if (!this.queue) return;

    // OTP Email Worker
    this.queue.process('otp-email', 5, async (job) => {
      const { to, otpCode, userName } = job.data;
      job.progress(10);
      
      await emailService.initialize();
      job.progress(30);
      
      const result = await emailService.sendOTPEmail(to, otpCode, userName);
      job.progress(100);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    });

    // Password Reset Email Worker
    this.queue.process('password-reset', 3, async (job) => {
      const { to, resetToken, userName, resetUrl } = job.data;
      job.progress(10);
      
      await emailService.initialize();
      job.progress(30);
      
      const result = await emailService.sendPasswordResetEmail(to, resetToken, userName, resetUrl);
      job.progress(100);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    });

    // Welcome Email Worker
    this.queue.process('welcome-email', 3, async (job) => {
      const { to, userName } = job.data;
      job.progress(10);
      
      await emailService.initialize();
      job.progress(30);
      
      const result = await emailService.sendWelcomeEmail(to, userName);
      job.progress(100);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    });

    // Notification Email Worker
    this.queue.process('notification', 5, async (job) => {
      const { to, title, message, userName, actionUrl, actionText } = job.data;
      job.progress(10);
      
      await emailService.initialize();
      job.progress(30);
      
      const result = await emailService.sendNotificationEmail(to, title, message, userName, actionUrl, actionText);
      job.progress(100);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    });

    console.log('✅ Email queue workers set up successfully');
  }

  /**
   * Add OTP email to queue
   * @param {string} to - Recipient email
   * @param {string} otpCode - OTP code
   * @param {string} userName - User name
   * @param {Object} options - Job options (delay, priority, etc.)
   * @returns {Promise<Object>} Job details
   */
  async addOTPEmail(to, otpCode, userName = 'User', options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobOptions = {
      priority: 'high',
      delay: 0,
      ...options
    };

    const job = await this.queue.add('otp-email', {
      type: 'otp-email',
      to,
      otpCode,
      userName,
      timestamp: new Date().toISOString()
    }, jobOptions);

    console.log(`📧 OTP email queued for ${to} with job ID: ${job.id}`);
    return { jobId: job.id, type: 'otp-email' };
  }

  /**
   * Add password reset email to queue
   * @param {string} to - Recipient email
   * @param {string} resetToken - Reset token
   * @param {string} userName - User name
   * @param {string} resetUrl - Custom reset URL (optional)
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job details
   */
  async addPasswordResetEmail(to, resetToken, userName = 'User', resetUrl = null, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobOptions = {
      priority: 'high',
      delay: 0,
      ...options
    };

    const job = await this.queue.add('password-reset', {
      type: 'password-reset',
      to,
      resetToken,
      userName,
      resetUrl,
      timestamp: new Date().toISOString()
    }, jobOptions);

    console.log(`📧 Password reset email queued for ${to} with job ID: ${job.id}`);
    return { jobId: job.id, type: 'password-reset' };
  }

  /**
   * Add welcome email to queue
   * @param {string} to - Recipient email
   * @param {string} userName - User name
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job details
   */
  async addWelcomeEmail(to, userName, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobOptions = {
      priority: 'normal',
      delay: 0,
      ...options
    };

    const job = await this.queue.add('welcome-email', {
      type: 'welcome-email',
      to,
      userName,
      timestamp: new Date().toISOString()
    }, jobOptions);

    console.log(`📧 Welcome email queued for ${to} with job ID: ${job.id}`);
    return { jobId: job.id, type: 'welcome-email' };
  }

  /**
   * Add notification email to queue
   * @param {string} to - Recipient email
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} userName - User name
   * @param {string} actionUrl - Action URL (optional)
   * @param {string} actionText - Action button text (optional)
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job details
   */
  async addNotificationEmail(to, title, message, userName = 'User', actionUrl = null, actionText = 'View Details', options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobOptions = {
      priority: 'normal',
      delay: 0,
      ...options
    };

    const job = await this.queue.add('notification', {
      type: 'notification',
      to,
      title,
      message,
      userName,
      actionUrl,
      actionText,
      timestamp: new Date().toISOString()
    }, jobOptions);

    console.log(`📧 Notification email queued for ${to} with job ID: ${job.id}`);
    return { jobId: job.id, type: 'notification' };
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    if (!this.queue) {
      throw new Error('Email queue not initialized');
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { status: 'not-found' };
    }

    const state = await job.getState();
    return {
      id: job.id,
      status: state,
      progress: job._progress || 0,
      data: job.data,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason || null,
    };
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  async getStats() {
    if (!this.queue) {
      return { error: 'Queue not initialized' };
    }

    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }

  /**
   * Clean up old jobs
   * @param {number} maxAge - Max age in milliseconds
   * @returns {Promise<number>} Number of cleaned jobs
   */
  async cleanup(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    if (!this.queue) {
      return 0;
    }

    const cleanedCompleted = await this.queue.clean(maxAge, 'completed');
    const cleanedFailed = await this.queue.clean(maxAge, 'failed');
    
    const total = cleanedCompleted.length + cleanedFailed.length;
    console.log(`🧹 Cleaned ${total} old email jobs`);
    
    return total;
  }

  /**
   * Pause the queue
   */
  async pause() {
    if (this.queue) {
      await this.queue.pause();
      console.log('⏸️ Email queue paused');
    }
  }

  /**
   * Resume the queue
   */
  async resume() {
    if (this.queue) {
      await this.queue.resume();
      console.log('▶️ Email queue resumed');
    }
  }

  /**
   * Shutdown the queue gracefully
   */
  async shutdown() {
    if (this.queue) {
      await this.queue.close();
      console.log('🛑 Email queue shut down');
    }
    this.isInitialized = false;
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      hasQueue: !!this.queue,
      redisConnected: redisManager.isConnected,
      usingMemoryStore: !redisManager.isConnected
    };
  }
}

// Create and export singleton instance
const emailQueue = new EmailQueue();

module.exports = emailQueue; 