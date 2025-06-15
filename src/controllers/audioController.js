const AudioRecording = require('../models/AudioRecording');
const Baby = require('../models/Baby');
const fs = require('fs');
const path = require('path');
const { sendSuccessResponse, sendErrorResponse, asyncHandler } = require('../middleware/errorHandler');
const { audioRecordingsDir } = require('../middleware/upload');
const jobManager = require('../jobs/jobManager');

/**
 * Upload audio recording for a baby
 * @route POST /api/audio/upload
 * @access Private
 */
const uploadAudioRecording = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { babyId, duration, recordingContext } = req.body;

  // Debug logging for troubleshooting
  console.log('=== Audio Upload Debug ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('req.headers:', req.headers);
  console.log('========================');

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Check if file was uploaded
  if (!req.file) {
    return sendErrorResponse(res, 400, 'No audio file provided', 'NO_FILE_PROVIDED');
  }

  // Validate that file has required properties
  if (!req.file.filename && !req.file.originalname) {
    console.error('❌ File upload failed: Missing filename and originalname');
    console.error('req.file content:', JSON.stringify(req.file, null, 2));
    return sendErrorResponse(res, 400, 'File upload failed: Missing file information', 'INVALID_FILE_UPLOAD');
  }

  // Validate baby ownership
  const baby = await Baby.findOne({ _id: babyId, parentId: userId, isActive: true });
  if (!baby) {
    // Clean up uploaded file if baby validation fails
    try {
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    return sendErrorResponse(res, 404, 'Baby not found or access denied', 'BABY_NOT_FOUND');
  }

  try {
    // Handle file path - for cloud storage it might be undefined
    let filePath = '';
    if (req.file.path) {
      filePath = path.relative(process.cwd(), req.file.path);
    } else if (req.file.location) {
      // For cloud storage (S3/Minio), use location
      filePath = req.file.location;
    } else if (req.file.key) {
      // For S3/Minio, use key
      filePath = req.file.key;
    } else {
      // Fallback to filename
      filePath = `audio-recordings/${req.file.filename || req.file.originalname}`;
    }

    // Ensure we have a filename - use originalname as fallback
    let filename = req.file.filename; // This is undefined for multer-s3
    let originalName = req.file.originalname;
    
    // For multer-s3, extract filename from key
    if (!filename && req.file.key) {
      // Extract filename from S3 key (e.g., "audio-recordings/audio-userId-timestamp-hash.wav")
      filename = path.basename(req.file.key);
    }
    
    // If still no filename, generate one
    if (!filename) {
      const timestamp = Date.now();
      const extension = path.extname(originalName || '.wav');
      filename = `audio-${timestamp}${extension}`;
    }
    
    // Ensure we have originalName
    if (!originalName) {
      originalName = filename;
    }

    // Prepare audio recording data
    const audioData = {
      filename: filename,
      originalName: originalName,
      filePath: filePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      babyId: babyId,
      userId: userId,
      analysisStatus: 'pending'
    };

    console.log('📝 Audio data to save:', audioData);

    // Add duration if provided
    if (duration && !isNaN(parseFloat(duration))) {
      audioData.duration = parseFloat(duration);
    }

    // Add recording context if provided
    if (recordingContext) {
      try {
        const context = typeof recordingContext === 'string' 
          ? JSON.parse(recordingContext) 
          : recordingContext;
        
        audioData.recordingContext = {};
        
        if (context.timeOfDay && ['morning', 'afternoon', 'evening', 'night'].includes(context.timeOfDay)) {
          audioData.recordingContext.timeOfDay = context.timeOfDay;
        }
        if (context.beforeFeeding !== undefined) {
          audioData.recordingContext.beforeFeeding = Boolean(context.beforeFeeding);
        }
        if (context.afterFeeding !== undefined) {
          audioData.recordingContext.afterFeeding = Boolean(context.afterFeeding);
        }
        if (context.beforeSleep !== undefined) {
          audioData.recordingContext.beforeSleep = Boolean(context.beforeSleep);
        }
        if (context.afterSleep !== undefined) {
          audioData.recordingContext.afterSleep = Boolean(context.afterSleep);
        }
        if (context.notes && typeof context.notes === 'string') {
          audioData.recordingContext.notes = context.notes.substring(0, 500);
        }
      } catch (parseError) {
        console.error('Error parsing recording context:', parseError);
        // Continue without recording context rather than failing
      }
    }

    // Create audio recording in database
    const audioRecording = new AudioRecording(audioData);
    const savedRecording = await audioRecording.save();

    // Trigger automatic ML analysis (background job)
    let analysisQueued = false;
    let queuedAt = null;
    
    try {
      await jobManager.scheduleAudioAnalysis(savedRecording._id.toString());
      analysisQueued = true;
      queuedAt = new Date().toISOString();
      console.log(`🤖 ML analysis automatically queued for recording: ${savedRecording._id}`);
    } catch (analysisError) {
      console.error('Failed to queue automatic ML analysis:', analysisError);
      // Don't fail the upload if analysis queuing fails
      // The analysis can be triggered manually later
    }

    // Format response data
    const responseData = {
      id: savedRecording._id,
      filename: savedRecording.filename,
      originalName: savedRecording.originalName,
      fileSize: savedRecording.fileSize,
      fileSizeFormatted: savedRecording.fileSizeFormatted,
      mimeType: savedRecording.mimeType,
      duration: savedRecording.duration,
      durationFormatted: savedRecording.durationFormatted,
      fileUrl: savedRecording.fileUrl,
      babyId: savedRecording.babyId,
      analysisStatus: savedRecording.analysisStatus,
      recordingContext: savedRecording.recordingContext,
      uploadedAt: savedRecording.analysisMetadata.uploadedAt,
      createdAt: savedRecording.createdAt,
      // ML analysis info
      analysis: {
        queued: analysisQueued,
        queuedAt: queuedAt,
        status: savedRecording.analysisStatus
      }
    };

    const message = analysisQueued 
      ? 'Audio recording uploaded and ML analysis queued successfully'
      : 'Audio recording uploaded successfully (ML analysis can be triggered manually)';

    return sendSuccessResponse(res, 201, message, {
      recording: responseData
    });

  } catch (dbError) {
    // Log the full error for debugging
    console.error('❌ Database error during audio upload:', dbError);
    console.error('Error details:', {
      name: dbError.name,
      message: dbError.message,
      code: dbError.code,
      stack: dbError.stack
    });

    // Clean up uploaded file if database operation fails
    try {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    throw dbError; // Re-throw to be handled by asyncHandler
  }
});

/**
 * Get all audio recordings for authenticated user
 * @route GET /api/audio/recordings
 * @access Private
 */
const getAllRecordings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { babyId, status, page = 1, limit = 20 } = req.query;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Build query filters
  const filters = { userId, isActive: true };
  
  if (babyId) {
    // Verify baby ownership
    const baby = await Baby.findOne({ _id: babyId, parentId: userId, isActive: true });
    if (!baby) {
      return sendErrorResponse(res, 404, 'Baby not found or access denied', 'BABY_NOT_FOUND');
    }
    filters.babyId = babyId;
  }

  if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
    filters.analysisStatus = status;
  }

  // Calculate pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 records per page
  const skip = (pageNumber - 1) * limitNumber;

  // Get recordings with pagination
  const recordings = await AudioRecording.find(filters)
    .populate('babyId', 'name birthDate')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);

  // Get total count for pagination metadata
  const totalRecordings = await AudioRecording.countDocuments(filters);
  const totalPages = Math.ceil(totalRecordings / limitNumber);

  // Format response data
  const responseData = recordings.map(recording => ({
    id: recording._id,
    filename: recording.filename,
    originalName: recording.originalName,
    fileSize: recording.fileSize,
    fileSizeFormatted: recording.fileSizeFormatted,
    mimeType: recording.mimeType,
    duration: recording.duration,
    durationFormatted: recording.durationFormatted,
    fileUrl: recording.fileUrl,
    baby: recording.babyId ? {
      id: recording.babyId._id,
      name: recording.babyId.name,
      birthDate: recording.babyId.birthDate
    } : null,
    analysisStatus: recording.analysisStatus,
    // Include ML analysis results if completed
    mlAnalysis: recording.analysisStatus === 'completed' && recording.mlAnalysis ? {
      prediction: recording.mlAnalysis.prediction,
      confidence: recording.mlAnalysis.confidence,
      allPredictions: Object.fromEntries(recording.mlAnalysis.allPredictions || new Map())
    } : null,
    recordingContext: recording.recordingContext,
    uploadedAt: recording.analysisMetadata.uploadedAt,
    analyzedAt: recording.analysisMetadata.analyzedAt,
    retryCount: recording.analysisMetadata?.retryCount || 0,
    createdAt: recording.createdAt
  }));

  return sendSuccessResponse(res, 200, 'Audio recordings retrieved successfully', {
    recordings: responseData,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      totalRecordings,
      recordsPerPage: limitNumber,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1
    }
  });
});

/**
 * Get specific audio recording by ID
 * @route GET /api/audio/recordings/:id
 * @access Private
 */
const getRecordingById = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const recordingId = req.params.id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Find recording and verify ownership
  const recording = await AudioRecording.findOne({ 
    _id: recordingId, 
    userId, 
    isActive: true 
  }).populate('babyId', 'name birthDate');

  if (!recording) {
    return sendErrorResponse(res, 404, 'Audio recording not found', 'RECORDING_NOT_FOUND');
  }

  // Format response data
  const responseData = {
    id: recording._id,
    filename: recording.filename,
    originalName: recording.originalName,
    fileSize: recording.fileSize,
    fileSizeFormatted: recording.fileSizeFormatted,
    mimeType: recording.mimeType,
    duration: recording.duration,
    durationFormatted: recording.durationFormatted,
    fileUrl: recording.fileUrl,
    baby: recording.babyId ? {
      id: recording.babyId._id,
      name: recording.babyId.name,
      birthDate: recording.babyId.birthDate
    } : null,
    analysisStatus: recording.analysisStatus,
    // Include complete ML analysis results if available
    mlAnalysis: recording.analysisStatus === 'completed' && recording.mlAnalysis ? {
      prediction: recording.mlAnalysis.prediction,
      confidence: recording.mlAnalysis.confidence,
      allPredictions: Object.fromEntries(recording.mlAnalysis.allPredictions || new Map()),
      featureShape: recording.mlAnalysis.featureShape
    } : null,
    audioMetadata: recording.audioMetadata,
    recordingContext: recording.recordingContext,
    analysisMetadata: recording.analysisMetadata,
    mlServiceResponse: {
      processingTime: recording.mlServiceResponse?.processingTime,
      error: recording.mlServiceResponse?.error
    },
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt
  };

  return sendSuccessResponse(res, 200, 'Audio recording retrieved successfully', {
    recording: responseData
  });
});

/**
 * Get pending ML analysis recordings for user
 * @route GET /api/audio/pending-analysis
 * @access Private
 */
const getPendingAnalysisRecordings = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Find recordings with pending or failed analysis (that can be retried)
  const pendingRecordings = await AudioRecording.find({ 
    userId, 
    isActive: true,
    $or: [
      { analysisStatus: 'pending' },
      { 
        analysisStatus: 'failed',
        'analysisMetadata.retryCount': { $lt: 3 }
      }
    ]
  })
  .populate('babyId', 'name birthDate')
  .sort({ createdAt: -1 })
  .limit(50); // Limit to 50 most recent

  // Format response data
  const responseData = pendingRecordings.map(recording => ({
    id: recording._id,
    filename: recording.filename,
    originalName: recording.originalName,
    baby: recording.babyId ? {
      id: recording.babyId._id,
      name: recording.babyId.name
    } : null,
    analysisStatus: recording.analysisStatus,
    retryCount: recording.analysisMetadata?.retryCount || 0,
    uploadedAt: recording.analysisMetadata.uploadedAt,
    lastRetryAt: recording.analysisMetadata.lastRetryAt,
    canRetry: recording.canRetryAnalysis(),
    createdAt: recording.createdAt
  }));

  return sendSuccessResponse(res, 200, 'Pending analysis recordings retrieved successfully', {
    recordings: responseData,
    totalCount: responseData.length
  });
});

/**
 * Trigger ML analysis for multiple recordings
 * @route POST /api/audio/batch-analyze
 * @access Private
 */
const batchTriggerAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { recordingIds, analyzeAllPending = false } = req.body;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  let targetRecordings = [];

  if (analyzeAllPending) {
    // Get all pending recordings for user
    targetRecordings = await AudioRecording.find({ 
      userId, 
      isActive: true,
      $or: [
        { analysisStatus: 'pending' },
        { 
          analysisStatus: 'failed',
          'analysisMetadata.retryCount': { $lt: 3 }
        }
      ]
    }).limit(20); // Limit to 20 recordings for safety
  } else if (recordingIds && Array.isArray(recordingIds)) {
    // Get specific recordings
    targetRecordings = await AudioRecording.find({
      _id: { $in: recordingIds },
      userId,
      isActive: true
    });
  } else {
    return sendErrorResponse(res, 400, 'Either recordingIds array or analyzeAllPending flag is required', 'INVALID_REQUEST');
  }

  if (targetRecordings.length === 0) {
    return sendErrorResponse(res, 404, 'No eligible recordings found for analysis', 'NO_RECORDINGS_FOUND');
  }

  // Track results
  const results = {
    total: targetRecordings.length,
    queued: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  // Process each recording
  for (const recording of targetRecordings) {
    try {
      // Check if recording can be analyzed
      if (recording.analysisStatus === 'completed') {
        results.skipped++;
        results.details.push({
          recordingId: recording._id,
          filename: recording.filename,
          status: 'skipped',
          reason: 'Already completed'
        });
        continue;
      }

      if (recording.analysisStatus === 'processing') {
        results.skipped++;
        results.details.push({
          recordingId: recording._id,
          filename: recording.filename,
          status: 'skipped',
          reason: 'Currently processing'
        });
        continue;
      }

      if (recording.analysisStatus === 'failed' && !recording.canRetryAnalysis()) {
        results.skipped++;
        results.details.push({
          recordingId: recording._id,
          filename: recording.filename,
          status: 'skipped',
          reason: 'Exceeded retry limit'
        });
        continue;
      }

      // Queue analysis
      await jobManager.scheduleAudioAnalysis(recording._id.toString());
      
      // Update status if it was failed
      if (recording.analysisStatus === 'failed') {
        recording.analysisStatus = 'pending';
        await recording.save();
      }

      results.queued++;
      results.details.push({
        recordingId: recording._id,
        filename: recording.filename,
        status: 'queued',
        queuedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Failed to queue analysis for recording ${recording._id}:`, error);
      results.failed++;
      results.details.push({
        recordingId: recording._id,
        filename: recording.filename,
        status: 'failed',
        error: error.message
      });
    }
  }

  const message = `Batch analysis processing completed: ${results.queued} queued, ${results.skipped} skipped, ${results.failed} failed`;

  return sendSuccessResponse(res, 200, message, {
    results
  });
});

/**
 * Delete audio recording and associated file
 * @route DELETE /api/audio/recordings/:id
 * @access Private
 */
const deleteRecording = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const recordingId = req.params.id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Find recording and verify ownership
  const recording = await AudioRecording.findOne({ 
    _id: recordingId, 
    userId, 
    isActive: true 
  });

  if (!recording) {
    return sendErrorResponse(res, 404, 'Audio recording not found', 'RECORDING_NOT_FOUND');
  }

  try {
    // Construct full file path
    const fullFilePath = path.join(process.cwd(), recording.filePath);
    
    // Check if file exists and delete it
    if (fs.existsSync(fullFilePath)) {
      fs.unlinkSync(fullFilePath);
      console.log(`Successfully deleted audio file: ${recording.filename}`);
    } else {
      console.warn(`Audio file not found on disk: ${recording.filename}`);
      // Continue with database deletion even if file doesn't exist
    }

    // Soft delete the recording (set isActive to false)
    recording.isActive = false;
    await recording.save();

    return sendSuccessResponse(res, 200, 'Audio recording deleted successfully', {
      deletedRecording: {
        id: recording._id,
        filename: recording.filename,
        originalName: recording.originalName,
        deletedAt: new Date()
      }
    });

  } catch (fileError) {
    console.error('Error deleting audio file:', fileError);
    
    // If file deletion fails, still proceed with database soft delete
    // This ensures data consistency even if file system operations fail
    recording.isActive = false;
    await recording.save();

    return sendSuccessResponse(res, 200, 'Audio recording deleted from database (file deletion failed)', {
      deletedRecording: {
        id: recording._id,
        filename: recording.filename,
        originalName: recording.originalName,
        deletedAt: new Date()
      },
      warning: 'File could not be deleted from storage'
    });
  }
});

/**
 * Cleanup orphaned or temporary audio files
 * @route POST /api/audio/cleanup
 * @access Private (Admin only - could be added later)
 */
const cleanupAudioFiles = asyncHandler(async (req, res) => {
  // This function can be used for maintenance/cleanup operations
  // For now, it's a placeholder for future implementation
  
  try {
    // Get all active recordings from database
    const activeRecordings = await AudioRecording.find({ isActive: true });
    const activeFilenames = new Set(activeRecordings.map(r => r.filename));

    // Read all files in audio recordings directory
    const audioDir = path.join(process.cwd(), 'uploads', 'audio-recordings');
    
    if (!fs.existsSync(audioDir)) {
      return sendSuccessResponse(res, 200, 'Audio recordings directory does not exist', {
        cleanupResults: {
          filesScanned: 0,
          filesDeleted: 0,
          orphanedFiles: []
        }
      });
    }

    const allFiles = fs.readdirSync(audioDir);
    const orphanedFiles = [];
    let deletedCount = 0;

    // Find orphaned files (files not in database)
    for (const filename of allFiles) {
      if (!activeFilenames.has(filename)) {
        const filePath = path.join(audioDir, filename);
        try {
          fs.unlinkSync(filePath);
          orphanedFiles.push(filename);
          deletedCount++;
          console.log(`Deleted orphaned audio file: ${filename}`);
        } catch (deleteError) {
          console.error(`Failed to delete orphaned file ${filename}:`, deleteError);
        }
      }
    }

    return sendSuccessResponse(res, 200, 'Audio files cleanup completed', {
      cleanupResults: {
        filesScanned: allFiles.length,
        filesDeleted: deletedCount,
        orphanedFiles: orphanedFiles
      }
    });

  } catch (error) {
    console.error('Error during audio files cleanup:', error);
    return sendErrorResponse(res, 500, 'Failed to cleanup audio files', 'CLEANUP_FAILED');
  }
});

module.exports = {
  uploadAudioRecording,
  getAllRecordings,
  getRecordingById,
  getPendingAnalysisRecordings,
  batchTriggerAnalysis,
  deleteRecording,
  cleanupAudioFiles
}; 