const Agenda = require('agenda');
const AudioRecording = require('../models/AudioRecording');
const mlService = require('../services/mlService');
const fileStorageService = require('../services/fileStorage');
const path = require('path');
const fs = require('fs');

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
      // MongoDB connection options for Agenda
      const mongoOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true
      };

      // Add authentication source for production
      if (process.env.NODE_ENV === 'production') {
        mongoOptions.authSource = 'admin';
      }

      // Initialize agenda with MongoDB connection
      this.agenda = new Agenda({
        db: {
          address: process.env.MONGODB_URI,
          collection: 'agendaJobs',
          options: mongoOptions
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
    // Audio analysis job
    this.agenda.define('analyze audio', { priority: 'high', concurrency: 2 }, async (job) => {
      const { recordingId } = job.attrs.data;
      
      try {
        // Find the audio recording and populate baby data
        const recording = await AudioRecording.findById(recordingId)
          .populate('babyId', 'name birthDate')
          .populate('userId', 'email');
          
        if (!recording) {
          throw new Error(`Audio recording not found: ${recordingId}`);
        }

        if (!recording.babyId || !recording.babyId.birthDate) {
          throw new Error(`Baby birth date not found for recording: ${recordingId}`);
        }

        console.log(`🎯 Processing audio analysis for recording: ${recordingId}`, {
          filename: recording.filename,
          baby: recording.babyId.name,
          birthDate: recording.babyId.birthDate
        });

        // Check if ML service is available before attempting analysis
        const isServiceAvailable = await mlService.isServiceAvailable();
        
        if (!isServiceAvailable) {
          console.log(`⚠️ ML Service not available, marking analysis as failed for recording: ${recordingId}`);
          
          // Update recording status to failed
          await AudioRecording.findByIdAndUpdate(recordingId, {
            analysisStatus: 'failed',
            'mlServiceResponse.error': 'ML Service is not available',
            'analysisMetadata.analyzedAt': new Date()
          });
          
          throw new Error('ML Service is not available');
        }

        // Update status to processing
        await AudioRecording.findByIdAndUpdate(recordingId, {
          analysisStatus: 'processing',
          'analysisMetadata.retryCount': { $inc: 1 }
        });

        // For cloud storage, we need to construct the file path differently
        let audioFilePath;
        
        if (process.env.NODE_ENV === 'production' && recording.filePath.startsWith('http')) {
          // For cloud storage URLs, we'll need to download the file first
          // This is a simplified version - you might want to implement file streaming
          console.log(`📁 Audio file stored in cloud storage: ${recording.filePath}`);
          throw new Error('Cloud storage file analysis not yet implemented');
        } else {
          // Local file path
          audioFilePath = path.resolve(recording.filePath);
          
          if (!fs.existsSync(audioFilePath)) {
            throw new Error(`Audio file not found at path: ${audioFilePath}`);
          }
        }

        console.log(`🔍 Analyzing audio file: ${audioFilePath}`);
        
        // Prepare metadata for enhanced ML prediction
        const dateOfBirth = recording.babyId.birthDate.toISOString();
        const babyId = recording.babyId._id.toString();
        
        // Get historical analysis data for this baby (last 10 recordings)
        const historicalRecordings = await AudioRecording.find({
          babyId: recording.babyId._id,
          analysisStatus: 'completed',
          'mlAnalysis.prediction': { $exists: true },
          _id: { $ne: recordingId } // Exclude current recording
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('mlAnalysis.prediction mlAnalysis.confidence createdAt recordingContext');
        
        // Format historical data for ML service
        const historyData = historicalRecordings.map(rec => ({
          prediction: rec.mlAnalysis.prediction,
          confidence: rec.mlAnalysis.confidence,
          timestamp: rec.createdAt.toISOString(),
          context: rec.recordingContext || {}
        }));
        
        console.log(`📊 Including ${historyData.length} historical recordings for enhanced prediction`);
        
        // Call ML service for prediction with metadata
        const predictionResult = await mlService.predictWithMetadata(
          audioFilePath, 
          dateOfBirth, 
          historyData, 
          babyId
        );
        
        if (!predictionResult.success) {
          throw new Error(`ML prediction failed: ${predictionResult.error}`);
        }

        const prediction = predictionResult.data;
        console.log(`🎯 ML Prediction result:`, prediction);

        // Update recording with analysis results
        const updateData = {
          analysisStatus: 'completed',
          'mlAnalysis.prediction': prediction.prediction,
          'mlAnalysis.confidence': prediction.confidence,
          'mlAnalysis.allPredictions': new Map(Object.entries(prediction.all_predictions || {})),
          'mlAnalysis.featureShape': prediction.feature_shape,
          'mlServiceResponse.modelVersion': prediction.model_version || 'unknown',
          'mlServiceResponse.processingTime': prediction.processing_time || null,
          'mlServiceResponse.rawResponse': prediction,
          'analysisMetadata.analyzedAt': new Date()
        };

        const updatedRecording = await AudioRecording.findByIdAndUpdate(
          recordingId, 
          updateData, 
          { new: true }
        );

        console.log(`✅ Audio analysis completed for recording: ${recordingId}`);
        console.log(`🎯 Prediction: ${prediction.prediction} (confidence: ${(prediction.confidence * 100).toFixed(1)}%)`);

        return updatedRecording;
        
      } catch (error) {
        console.error(`❌ Audio analysis failed for recording: ${recordingId}`, error);
        
        // Update recording status to failed
        try {
          const retryData = await AudioRecording.findById(recordingId);
          const currentRetryCount = retryData?.analysisMetadata?.retryCount || 0;
          
          if (currentRetryCount < 3) {
            // Schedule retry with exponential backoff
            const retryDelay = Math.pow(2, currentRetryCount) * 60000; // 1, 2, 4 minutes
            const retryAt = new Date(Date.now() + retryDelay);
            
            console.log(`📅 Audio analysis scheduled for recording: ${recordingId} at ${retryAt.toISOString()}`);
            console.log(`🔄 Scheduled retry ${currentRetryCount + 1} for recording: ${recordingId} in ${retryDelay}ms`);
            
            // Schedule the retry using agenda.schedule
            await this.agenda.schedule(retryAt, 'analyze audio', { recordingId });
            
            // Update retry metadata but keep status as pending for retry
            await AudioRecording.findByIdAndUpdate(recordingId, {
              $set: {
                'analysisMetadata.retryCount': currentRetryCount + 1,
                'analysisMetadata.lastRetryAt': new Date(),
                'mlServiceResponse.error': error.message
              }
            });
          } else {
            // Max retries reached, mark as permanently failed
            await AudioRecording.findByIdAndUpdate(recordingId, {
              $set: {
                analysisStatus: 'failed',
                'mlServiceResponse.error': `Max retries reached: ${error.message}`,
                'analysisMetadata.analyzedAt': new Date()
              }
            });
            
            console.log(`❌ Max retries reached for recording: ${recordingId}, marking as permanently failed`);
          }
        } catch (updateError) {
          console.error(`❌ Failed to update recording after analysis error:`, updateError);
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