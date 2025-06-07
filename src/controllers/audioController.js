const AudioRecording = require('../models/AudioRecording');
const Baby = require('../models/Baby');
const fs = require('fs');
const path = require('path');
const { sendSuccessResponse, sendErrorResponse, asyncHandler } = require('../middleware/errorHandler');
const { audioRecordingsDir } = require('../middleware/upload');

/**
 * Upload audio recording for a baby
 * @route POST /api/audio/upload
 * @access Private
 */
const uploadAudioRecording = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { babyId, duration, recordingContext } = req.body;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Check if file was uploaded
  if (!req.file) {
    return sendErrorResponse(res, 400, 'No audio file provided', 'NO_FILE_PROVIDED');
  }

  // Validate baby ownership
  const baby = await Baby.findOne({ _id: babyId, parentId: userId, isActive: true });
  if (!baby) {
    // Clean up uploaded file if baby validation fails
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    return sendErrorResponse(res, 404, 'Baby not found or access denied', 'BABY_NOT_FOUND');
  }

  try {
    // Prepare audio recording data
    const audioData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: path.relative(process.cwd(), req.file.path),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      babyId: babyId,
      userId: userId,
      analysisStatus: 'pending'
    };

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
      createdAt: savedRecording.createdAt
    };

    return sendSuccessResponse(res, 201, 'Audio recording uploaded successfully', {
      recording: responseData
    });

  } catch (dbError) {
    // Clean up uploaded file if database operation fails
    try {
      fs.unlinkSync(req.file.path);
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
    emotionResult: recording.emotionResult,
    recordingContext: recording.recordingContext,
    uploadedAt: recording.analysisMetadata.uploadedAt,
    analyzedAt: recording.analysisMetadata.analyzedAt,
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
    emotionResult: recording.emotionResult,
    audioMetadata: recording.audioMetadata,
    recordingContext: recording.recordingContext,
    analysisMetadata: recording.analysisMetadata,
    mlServiceResponse: recording.mlServiceResponse,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt
  };

  return sendSuccessResponse(res, 200, 'Audio recording retrieved successfully', {
    recording: responseData
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
  deleteRecording,
  cleanupAudioFiles
}; 