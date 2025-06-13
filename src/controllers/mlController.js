const mlService = require('../services/mlService');
const jobManager = require('../jobs/jobManager');
const AudioRecording = require('../models/AudioRecording');
const Baby = require('../models/Baby');
const { validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * ML Controller
 * Handles ML service integration endpoints
 */

/**
 * GET /api/ml/status
 * Check ML service health and availability
 */
const getMLServiceStatus = asyncHandler(async (req, res) => {
  try {
    const serviceStatus = await mlService.getServiceStatus();
    
    res.json({
      success: true,
      data: serviceStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Failed to get ML service status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ml/classes
 * Get available infant cry classification classes
 */
const getMLClasses = asyncHandler(async (req, res) => {
  try {
    const result = await mlService.getClasses();
    
    if (!result.success) {
      return res.status(503).json({
        success: false,
        message: 'Failed to get ML classes',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching ML classes',
      error: error.message
    });
  }
});

/**
 * POST /api/ml/analyze/:recordingId
 * Trigger ML analysis for a specific audio recording
 */
const triggerMLAnalysis = asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { recordingId } = req.params;
  const userId = req.user.id;

  try {
    // Find the recording and verify ownership
    const recording = await AudioRecording.findOne({
      _id: recordingId,
      userId: userId,
      isActive: true
    });

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Audio recording not found or access denied'
      });
    }

    // Check if analysis is already completed
    if (recording.analysisStatus === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'Analysis already completed for this recording',
        data: {
          recordingId: recording._id,
          status: recording.analysisStatus,
          result: recording.mlAnalysis
        }
      });
    }

    // Check if analysis is currently processing
    if (recording.analysisStatus === 'processing') {
      return res.status(409).json({
        success: false,
        message: 'Analysis is currently in progress',
        data: {
          recordingId: recording._id,
          status: recording.analysisStatus
        }
      });
    }

    // Check if can retry (for failed analyses)
    if (recording.analysisStatus === 'failed' && !recording.canRetryAnalysis()) {
      return res.status(409).json({
        success: false,
        message: 'Analysis has exceeded maximum retry attempts',
        data: {
          recordingId: recording._id,
          status: recording.analysisStatus,
          retryCount: recording.analysisMetadata.retryCount
        }
      });
    }

    // Schedule analysis job
    await jobManager.scheduleAudioAnalysis(recordingId);

    // Update status to pending if it was failed
    if (recording.analysisStatus === 'failed') {
      recording.analysisStatus = 'pending';
      await recording.save();
    }

    res.json({
      success: true,
      message: 'ML analysis triggered successfully',
      data: {
        recordingId: recording._id,
        filename: recording.filename,
        status: 'pending',
        queuedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Trigger ML analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger ML analysis',
      error: error.message
    });
  }
});

/**
 * GET /api/ml/analysis/:recordingId
 * Get ML analysis result for a specific recording
 */
const getMLAnalysisResult = asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { recordingId } = req.params;
  const userId = req.user.id;

  try {
    // Find the recording and verify ownership
    const recording = await AudioRecording.findOne({
      _id: recordingId,
      userId: userId,
      isActive: true
    }).populate('babyId', 'name birthDate');

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Audio recording not found or access denied'
      });
    }

    // Format response based on analysis status
    const response = {
      success: true,
      data: {
        recordingId: recording._id,
        filename: recording.filename,
        originalName: recording.originalName,
        baby: recording.babyId,
        analysisStatus: recording.analysisStatus,
        uploadedAt: recording.analysisMetadata.uploadedAt,
        analyzedAt: recording.analysisMetadata.analyzedAt,
        retryCount: recording.analysisMetadata.retryCount
      }
    };

    // Add ML results if completed
    if (recording.analysisStatus === 'completed' && recording.mlAnalysis) {
      response.data.mlAnalysis = {
        prediction: recording.mlAnalysis.prediction,
        confidence: recording.mlAnalysis.confidence,
        allPredictions: Object.fromEntries(recording.mlAnalysis.allPredictions || new Map()),
        featureShape: recording.mlAnalysis.featureShape
      };
      response.data.processingTime = recording.mlServiceResponse?.processingTime;
    }

    // Add error info if failed
    if (recording.analysisStatus === 'failed' && recording.mlServiceResponse?.error) {
      response.data.error = recording.mlServiceResponse.error;
      response.data.lastRetryAt = recording.analysisMetadata.lastRetryAt;
    }

    res.json(response);

  } catch (error) {
    console.error('Get ML analysis result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ML analysis result',
      error: error.message
    });
  }
});

/**
 * GET /api/ml/history/:userId
 * Get ML analysis history for a user
 */
const getMLAnalysisHistory = asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId: targetUserId } = req.params;
  const currentUserId = req.user.id;

  // Only allow users to access their own history
  if (targetUserId !== currentUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Cannot access other user\'s analysis history'
    });
  }

  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
    const status = req.query.status; // Filter by analysis status
    const prediction = req.query.prediction; // Filter by prediction result
    const sortBy = req.query.sortBy || 'createdAt'; // Sort field
    const order = req.query.order === 'asc' ? 1 : -1; // Sort order

    // Build query
    const query = {
      userId: currentUserId,
      isActive: true
    };

    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query.analysisStatus = status;
    }

    if (prediction && ['burping', 'discomfort', 'belly_pain', 'hungry', 'tired'].includes(prediction)) {
      query['mlAnalysis.prediction'] = prediction;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order;

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [recordings, totalCount] = await Promise.all([
      AudioRecording.find(query)
        .populate('babyId', 'name birthDate')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AudioRecording.countDocuments(query)
    ]);

    // Format results
    const formattedRecordings = recordings.map(recording => ({
      id: recording._id,
      filename: recording.filename,
      originalName: recording.originalName,
      baby: recording.babyId,
      analysisStatus: recording.analysisStatus,
      uploadedAt: recording.analysisMetadata?.uploadedAt,
      analyzedAt: recording.analysisMetadata?.analyzedAt,
      mlAnalysis: recording.analysisStatus === 'completed' && recording.mlAnalysis ? {
        prediction: recording.mlAnalysis.prediction,
        confidence: recording.mlAnalysis.confidence,
        allPredictions: Object.fromEntries(recording.mlAnalysis.allPredictions || new Map())
      } : null,
      retryCount: recording.analysisMetadata?.retryCount || 0,
      error: recording.analysisStatus === 'failed' ? recording.mlServiceResponse?.error : null
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    res.json({
      success: true,
      data: {
        recordings: formattedRecordings,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPreviousPage
        },
        filters: {
          status,
          prediction,
          sortBy,
          order: order === 1 ? 'asc' : 'desc'
        }
      }
    });

  } catch (error) {
    console.error('Get ML analysis history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ML analysis history',
      error: error.message
    });
  }
});

/**
 * GET /api/ml/stats/:userId
 * Get ML analysis statistics for a user
 */
const getMLAnalysisStats = asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const currentUserId = req.user.id;

  // Only allow users to access their own stats
  if (targetUserId !== currentUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Cannot access other user\'s statistics'
    });
  }

  try {
    // Get analysis statistics using aggregation
    const stats = await AudioRecording.aggregate([
      {
        $match: {
          userId: currentUserId,
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalRecordings: { $sum: 1 },
          completedAnalyses: {
            $sum: { $cond: [{ $eq: ['$analysisStatus', 'completed'] }, 1, 0] }
          },
          pendingAnalyses: {
            $sum: { $cond: [{ $eq: ['$analysisStatus', 'pending'] }, 1, 0] }
          },
          processingAnalyses: {
            $sum: { $cond: [{ $eq: ['$analysisStatus', 'processing'] }, 1, 0] }
          },
          failedAnalyses: {
            $sum: { $cond: [{ $eq: ['$analysisStatus', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get prediction distribution
    const predictionStats = await AudioRecording.aggregate([
      {
        $match: {
          userId: currentUserId,
          isActive: true,
          analysisStatus: 'completed',
          'mlAnalysis.prediction': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$mlAnalysis.prediction',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$mlAnalysis.confidence' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const baseStats = stats[0] || {
      totalRecordings: 0,
      completedAnalyses: 0,
      pendingAnalyses: 0,
      processingAnalyses: 0,
      failedAnalyses: 0
    };

    const formattedPredictionStats = predictionStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        avgConfidence: Math.round(stat.avgConfidence * 1000) / 1000 // Round to 3 decimal places
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        overview: baseStats,
        predictionDistribution: formattedPredictionStats,
        completionRate: baseStats.totalRecordings > 0 
          ? Math.round((baseStats.completedAnalyses / baseStats.totalRecordings) * 100)
          : 0
      }
    });

  } catch (error) {
    console.error('Get ML analysis stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ML analysis statistics',
      error: error.message
    });
  }
});

module.exports = {
  getMLServiceStatus,
  getMLClasses,
  triggerMLAnalysis,
  getMLAnalysisResult,
  getMLAnalysisHistory,
  getMLAnalysisStats
}; 