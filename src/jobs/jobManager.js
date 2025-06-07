const Agenda = require('agenda');
const AudioRecording = require('../models/AudioRecording');
const mlService = require('../services/mlService');
const fileStorageService = require('../services/fileStorage');

/**
 * Agenda Job Manager
 * Handles background job processing for ML analysis
 */
class JobManager {
  constructor() {
    this.agenda = null;
    this.isInitialized = false;
  }

  /**
   * Initialize agenda with database connection
   */
  async initialize() {
    if (this.isInitialized) {
      return this.agenda;
    }

    try {
      // Initialize agenda with MongoDB connection
      this.agenda = new Agenda({
        db: {
          address: process.env.MONGODB_URI,
          collection: 'agendaJobs',
          options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
          }
        },
        processEvery: '10 seconds', // Check for jobs every 10 seconds
        maxConcurrency: 3, // Maximum 3 concurrent jobs
        defaultConcurrency: 1, // Default 1 job at a time
        defaultLockLifetime: 5 * 60 * 1000, // 5 minutes lock lifetime
      });

      // Define job processors
      this.defineJobs();

      // Setup event listeners
      this.setupEventListeners();

      // Start agenda
      await this.agenda.start();
      
      this.isInitialized = true;
      console.log('✅ Job Manager initialized successfully');
      
      return this.agenda;
    } catch (error) {
      console.error('❌ Job Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Define all job processors
   */
  defineJobs() {
    // Audio analysis job processor
    this.agenda.define('analyze audio', { priority: 'high', concurrency: 2 }, async (job) => {
      const { recordingId } = job.attrs.data;
      
      try {
        console.log(`🔄 Starting audio analysis for recording: ${recordingId}`);
        
        // Find the audio recording
        const recording = await AudioRecording.findById(recordingId);
        if (!recording) {
          throw new Error(`Audio recording not found: ${recordingId}`);
        }

        // Check if already processed or processing
        if (['completed', 'processing'].includes(recording.analysisStatus)) {
          console.log(`⏭️ Recording ${recordingId} already processed/processing`);
          return;
        }

        // Mark as processing
        await recording.markAnalysisProcessing();
        
        // Check ML service availability
        const isAvailable = await mlService.isServiceAvailable();
        if (!isAvailable) {
          throw new Error('ML Service is not available');
        }

        const startTime = Date.now();

        // Send to ML service for prediction
        const result = await mlService.predictAudio(recording.filePath);
        
        if (!result.success) {
          throw new Error(`ML prediction failed: ${result.error}`);
        }

        const processingTime = Date.now() - startTime;

        // Update recording with results
        await recording.updateMLAnalysisResult(result.data, processingTime);
        
        console.log(`✅ Audio analysis completed for recording: ${recordingId}`, {
          prediction: result.data.prediction,
          confidence: result.data.confidence,
          processingTime: `${processingTime}ms`
        });

      } catch (error) {
        console.error(`❌ Audio analysis failed for recording: ${recordingId}`, error);
        
        // Mark as failed and increment retry count
        const recording = await AudioRecording.findById(recordingId);
        if (recording) {
          await recording.markAnalysisFailed(error.message);
          
          // Schedule retry if possible
          if (recording.canRetryAnalysis()) {
            const retryDelay = this.calculateRetryDelay(recording.analysisMetadata.retryCount);
            await this.scheduleAudioAnalysis(recordingId, retryDelay);
            console.log(`🔄 Scheduled retry ${recording.analysisMetadata.retryCount + 1} for recording: ${recordingId} in ${retryDelay}ms`);
          }
        }
        
        throw error;
      }
    });

    // Cleanup failed jobs older than 24 hours
    this.agenda.define('cleanup failed jobs', { priority: 'low' }, async (job) => {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const result = await AudioRecording.updateMany(
          {
            analysisStatus: 'failed',
            'analysisMetadata.lastRetryAt': { $lt: oneDayAgo },
            'analysisMetadata.retryCount': { $gte: 3 }
          },
          {
            $set: { 
              analysisStatus: 'cancelled',
              'mlServiceResponse.error': 'Analysis cancelled after maximum retries'
            }
          }
        );

        console.log(`🧹 Cleaned up ${result.modifiedCount} failed analysis jobs`);
      } catch (error) {
        console.error('❌ Failed job cleanup error:', error);
      }
    });

    // Cleanup temporary files older than 24 hours
    this.agenda.define('cleanup temp files', { priority: 'low' }, async (job) => {
      try {
        const result = await fileStorageService.cleanupTempFiles(24);
        
        if (result.success) {
          console.log(`🗑️ ${result.message}`);
          if (result.errors.length > 0) {
            console.warn(`⚠️ Some files could not be deleted:`, result.errors);
          }
        } else {
          console.error(`❌ Temp file cleanup failed: ${result.error}`);
        }
      } catch (error) {
        console.error('❌ Temp file cleanup job error:', error);
      }
    });

    // System health monitoring job
    this.agenda.define('system health check', { priority: 'normal' }, async (job) => {
      try {
        const systemMetrics = require('../utils/systemMetrics');
        const alerting = require('../utils/alerting');
        
        const healthStatus = await systemMetrics.getHealthStatus();
        
        // Check system health and trigger alerts if needed
        alerting.checkSystemHealth(healthStatus.metrics);
        
        // Log system metrics periodically
        console.log(`📊 System Health Check:`, {
          status: healthStatus.status,
          cpu: `${healthStatus.metrics.cpu.usage}%`,
          memory: `${healthStatus.metrics.memory.system.usagePercent}%`,
          uptime: healthStatus.metrics.uptime.service.formatted,
          warnings: healthStatus.warnings.length,
          errors: healthStatus.errors.length
        });
        
      } catch (error) {
        console.error('❌ System health check job error:', error);
      }
    });

    console.log('📋 Job definitions loaded');
  }

  /**
   * Setup event listeners for job monitoring
   */
  setupEventListeners() {
    // Job start
    this.agenda.on('start', (job) => {
      console.log(`🚀 Job started: ${job.attrs.name} [${job.attrs._id}]`);
    });

    // Job success
    this.agenda.on('success', (job) => {
      console.log(`✅ Job completed: ${job.attrs.name} [${job.attrs._id}]`);
    });

    // Job failure
    this.agenda.on('fail', (error, job) => {
      console.error(`❌ Job failed: ${job.attrs.name} [${job.attrs._id}]`, error);
    });

    console.log('👂 Job event listeners setup');
  }

  /**
   * Schedule audio analysis job
   * @param {string} recordingId - Audio recording ID
   * @param {number} delay - Delay in milliseconds (optional)
   */
  async scheduleAudioAnalysis(recordingId, delay = 0) {
    if (!this.isInitialized) {
      throw new Error('Job Manager not initialized');
    }

    try {
      const jobData = { recordingId };
      
      if (delay > 0) {
        const when = new Date(Date.now() + delay);
        await this.agenda.schedule(when, 'analyze audio', jobData);
        console.log(`📅 Audio analysis scheduled for recording: ${recordingId} at ${when.toISOString()}`);
      } else {
        await this.agenda.now('analyze audio', jobData);
        console.log(`🔥 Audio analysis queued immediately for recording: ${recordingId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to schedule audio analysis for recording: ${recordingId}`, error);
      throw error;
    }
  }

  /**
   * Schedule cleanup and monitoring jobs
   */
  async scheduleCleanupJob() {
    if (!this.isInitialized) {
      throw new Error('Job Manager not initialized');
    }

    try {
      // Schedule daily cleanup at 2 AM
      await this.agenda.every('24 hours', 'cleanup failed jobs');
      await this.agenda.every('24 hours', 'cleanup temp files');
      
      // Schedule system health monitoring every 5 minutes
      await this.agenda.every('5 minutes', 'system health check');
      
      console.log('🗓️ Scheduled jobs: daily cleanup + system health monitoring (5min)');
    } catch (error) {
      console.error('❌ Failed to schedule jobs:', error);
      throw error;
    }
  }

  /**
   * Calculate exponential backoff retry delay
   * @param {number} retryCount - Current retry count
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(retryCount) {
    // Exponential backoff: 30s, 2m, 8m
    const baseDelay = 30 * 1000; // 30 seconds
    return baseDelay * Math.pow(4, retryCount);
  }

  /**
   * Get job statistics
   */
  async getJobStats() {
    if (!this.isInitialized) {
      return { error: 'Job Manager not initialized' };
    }

    try {
      const jobs = await this.agenda.jobs({});
      const stats = {
        total: jobs.length,
        running: jobs.filter(job => job.attrs.lockedAt && !job.attrs.lastFinishedAt).length,
        failed: jobs.filter(job => job.attrs.failCount > 0).length,
        scheduled: jobs.filter(job => job.attrs.nextRunAt && job.attrs.nextRunAt > new Date()).length
      };

      return stats;
    } catch (error) {
      console.error('❌ Failed to get job stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Cancel specific job
   * @param {string} recordingId - Recording ID to cancel analysis for
   */
  async cancelAudioAnalysis(recordingId) {
    if (!this.isInitialized) {
      throw new Error('Job Manager not initialized');
    }

    try {
      const result = await this.agenda.cancel({ 'data.recordingId': recordingId });
      console.log(`🚫 Cancelled ${result} analysis jobs for recording: ${recordingId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to cancel analysis for recording: ${recordingId}`, error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.agenda) {
      console.log('🛑 Shutting down Job Manager...');
      await this.agenda.stop();
      console.log('✅ Job Manager stopped');
    }
  }
}

// Export singleton instance
module.exports = new JobManager(); 