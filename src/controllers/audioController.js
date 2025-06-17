const AudioRecording = require('../models/AudioRecording');
const Baby = require('../models/Baby');
const fs = require('fs');
const path = require('path');
const { sendSuccessResponse, sendErrorResponse, asyncHandler } = require('../middleware/errorHandler');
const { audioRecordingsDir } = require('../middleware/upload');
const jobManager = require('../jobs/jobManager');
const audioMetadataService = require('../services/audioMetadataService');

/**
 * Upload and process audio recording with auto-metadata detection
 * @route POST /api/audio/upload
 * @access Private
 */
const uploadAudioRecording = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  // SUPER DETAILED DEBUG LOGGING
  console.log('🔍 === AUDIO UPLOAD DEBUG START ===');
  console.log('📋 Request Details:');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Route Path:', req.route?.path);
  console.log('   Content-Type:', req.headers['content-type']);
  console.log('   Content-Length:', req.headers['content-length']);
  console.log('   User-Agent:', req.headers['user-agent']);
  
  console.log('📁 File Details:');
  console.log('   req.file exists:', !!req.file);
  if (req.file) {
    console.log('   File fieldname:', req.file.fieldname);
    console.log('   File originalname:', req.file.originalname);
    console.log('   File mimetype:', req.file.mimetype);
    console.log('   File size:', req.file.size);
    console.log('   File path:', req.file.path);
  } else {
    console.log('   ❌ NO FILE FOUND IN REQUEST');
  }
  
  console.log('📝 Body Details:');
  console.log('   req.body:', JSON.stringify(req.body, null, 2));
  console.log('   Object.keys(req.body):', Object.keys(req.body));
  
  console.log('👤 User Details:');
  console.log('   User ID:', userId);
  console.log('   User Active:', req.user.isActive);
  console.log('🔍 === AUDIO UPLOAD DEBUG END ===');
  
  // Extract all possible fields from request body - all except babyId are optional
  const { 
    babyId, 
    duration, // This will be overridden by auto-detected duration
    recordingContext,
    // Legacy fields for backward compatibility
    title,
    notes,
    recordingDate
  } = req.body;

  // Debug logging for troubleshooting
  console.log('=== Audio Upload Debug ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('req.headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('========================');

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Validate required fields first
  if (!babyId) {
    return sendErrorResponse(res, 400, 'Baby ID is required', 'MISSING_BABY_ID', {
      hint: 'Provide the babyId field in your multipart/form-data request',
      requiredFields: ['audio (file)', 'babyId'],
      providedFields: {
        file: req.file ? 'provided' : 'missing',
        babyId: babyId ? 'provided' : 'missing'
      }
    });
  }

  if (!req.file) {
    return sendErrorResponse(res, 400, 'Audio file is required', 'MISSING_AUDIO_FILE', {
      hint: 'Upload an audio file with field name "audio"',
      requiredFields: ['audio (file)', 'babyId'],
      supportedFormats: ['WAV', 'MP3', 'M4A', 'WebM', 'OGG'],
      maxFileSize: '50MB',
      maxDuration: '5 minutes'
    });
  }

  try {
    // Verify baby exists and belongs to user
    console.log('🔍 Looking for baby:', {
      babyId,
      userId: userId.toString(),
      userIdType: typeof userId
    });
    
    const baby = await Baby.findOne({ _id: babyId, parentId: userId, isActive: true });
    
    console.log('👶 Baby search result:', {
      found: !!baby,
      babyData: baby ? {
        id: baby._id.toString(),
        name: baby.name,
        parentId: baby.parentId.toString()
      } : null
    });
    
    if (!baby) {
      // Additional debugging - check if baby exists but with different parent
      const anyBaby = await Baby.findOne({ _id: babyId });
      console.log('🔍 Debug - Any baby with this ID:', {
        exists: !!anyBaby,
        parentId: anyBaby ? anyBaby.parentId.toString() : null,
        isActive: anyBaby ? anyBaby.isActive : null
      });
      
      return sendErrorResponse(res, 404, 'Baby not found or access denied', 'BABY_NOT_FOUND');
    }

    // Auto-extract metadata from uploaded file
    let extractedMetadata = null;
    let autoDuration = null;
    
    try {
      console.log('🔍 Extracting audio metadata...');
      
      // For cloud storage, req.file.path is undefined, but req.file.location exists
      // We need to handle this case by downloading the file temporarily or skipping metadata extraction
      let metadataFilePath = req.file.path;
      
      if (!metadataFilePath && req.file.location) {
        // File is in cloud storage, skip metadata extraction for now
        console.log('☁️ File stored in cloud storage, skipping metadata extraction');
        console.log('💡 Consider downloading file temporarily for metadata extraction if needed');
        
        // Create fallback metadata for cloud storage
        extractedMetadata = {
          isValid: false,
          extractionError: 'CLOUD_STORAGE_SKIP',
          notice: 'Metadata extraction skipped for cloud storage files',
          extractionMethod: 'cloud-storage-fallback',
          codec: 'unknown',
          format: 'unknown'
        };
      } else if (metadataFilePath) {
        // File is local, extract metadata normally
        extractedMetadata = await audioMetadataService.extractMetadata(metadataFilePath, req.file.originalname);
        
        if (extractedMetadata && extractedMetadata.duration) {
          autoDuration = extractedMetadata.duration;
          console.log(`✅ Auto-detected duration: ${autoDuration} seconds`);
        } else if (extractedMetadata && !extractedMetadata.isValid) {
          console.warn('⚠️ Metadata extraction failed, using fallback mode');
          
          // Check if it's an FFprobe issue
          if (extractedMetadata.extractionError === 'FFPROBE_NOT_FOUND') {
            console.log('💡 FFprobe not found - upload will continue without auto-detected metadata');
            console.log('   You can still provide duration manually via the "duration" field');
            console.log('   To enable auto-detection, install FFmpeg: https://ffmpeg.org/download.html');
          }
          
          // Continue with upload but without duration validation
        }
      } else {
        // Neither path nor location available, create fallback
        console.warn('⚠️ No file path or location available for metadata extraction');
        extractedMetadata = {
          isValid: false,
          extractionError: 'NO_FILE_PATH',
          notice: 'No file path available for metadata extraction',
          extractionMethod: 'no-path-fallback',
          codec: 'unknown',
          format: 'unknown'
        };
      }
    } catch (metadataError) {
      console.warn('⚠️ Metadata extraction error:', {
        error: metadataError.message,
        type: metadataError.constructor.name
      });
      
      // Create fallback metadata to prevent crashes
      extractedMetadata = {
        isValid: false,
        extractionError: 'EXTRACTION_FAILED',
        notice: `Metadata extraction failed: ${metadataError.message}`,
        extractionMethod: 'error-fallback',
        codec: 'unknown',
        format: 'unknown'
      };
      
      // Continue with upload - metadata extraction is not critical for basic functionality
      console.log('📤 Continuing upload without metadata extraction - this is normal if FFmpeg is not installed');
    }

    // Use auto-detected duration or manual input (prefer auto-detected)
    const finalDuration = autoDuration || (duration ? parseFloat(duration) : null);
    
    // Validate duration if available
    if (finalDuration) {
      if (finalDuration > 300) { // 5 minutes max
        return sendErrorResponse(res, 400, 
          `Audio duration (${finalDuration.toFixed(1)}s) exceeds maximum allowed duration of 5 minutes (300s)`,
          'DURATION_TOO_LONG'
        );
      }
      
      if (finalDuration < 0.1) {
        return sendErrorResponse(res, 400, 
          'Audio duration is too short (minimum 0.1 seconds)',
          'DURATION_TOO_SHORT'
        );
      }
    }

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

    // Use AUTO-DETECTED duration first, fallback to manual input
    if (extractedMetadata && extractedMetadata.duration) {
      audioData.duration = extractedMetadata.duration;
      console.log(`✅ Using auto-detected duration: ${extractedMetadata.duration} seconds`);
    } else if (finalDuration) {
      audioData.duration = finalDuration;
      console.log(`📝 Using manually provided duration: ${finalDuration.toFixed(1)} seconds`);
    }

    // Add detected audio metadata to the record
    if (extractedMetadata && extractedMetadata.isValid) {
      audioData.audioMetadata = {
        sampleRate: extractedMetadata.sampleRate,
        bitRate: extractedMetadata.bitRate,
        channels: extractedMetadata.channels,
        codec: extractedMetadata.codec,
        format: extractedMetadata.format,
        extractionMethod: extractedMetadata.extractionMethod
      };
    } else if (extractedMetadata && !extractedMetadata.isValid) {
      // Store fallback metadata with warning
      audioData.audioMetadata = {
        sampleRate: null,
        bitRate: null,
        channels: null,
        codec: extractedMetadata.codec,
        format: extractedMetadata.format,
        extractionMethod: extractedMetadata.extractionMethod,
        warning: extractedMetadata.notice
      };
    }

    // Add recording context if provided
    if (recordingContext) {
      try {
        console.log('📝 Raw recordingContext received:', {
          type: typeof recordingContext,
          value: recordingContext,
          length: recordingContext?.length
        });

        let context;
        
        // Handle different data formats
        if (typeof recordingContext === 'string') {
          // Clean up HTML entities that might be present
          let cleanContext = recordingContext
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          
          console.log('📝 Cleaned recordingContext:', cleanContext);
          
          // Skip parsing if empty or just whitespace
          if (!cleanContext || cleanContext.length === 0) {
            console.log('⚠️ Empty recordingContext, skipping');
            context = {};
          } else {
            // Try to parse JSON
            try {
              context = JSON.parse(cleanContext);
            } catch (jsonError) {
              console.warn('⚠️ Failed to parse recordingContext as JSON:', {
                error: jsonError.message,
                rawData: cleanContext.substring(0, 200) // First 200 chars for debugging
              });
              // Try to extract individual fields if it's not proper JSON
              context = {};
            }
          }
        } else if (typeof recordingContext === 'object' && recordingContext !== null) {
          context = recordingContext;
        } else {
          console.warn('⚠️ Invalid recordingContext type:', typeof recordingContext);
          context = {};
        }
        
        // Initialize recording context
        audioData.recordingContext = {};
        
        // Validate and set fields with proper type checking
        if (context && typeof context === 'object') {
          if (context.timeOfDay && typeof context.timeOfDay === 'string' && 
              ['morning', 'afternoon', 'evening', 'night'].includes(context.timeOfDay)) {
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
        }
        
        console.log('✅ Successfully processed recordingContext:', audioData.recordingContext);
        
      } catch (parseError) {
        console.error('❌ Error parsing recording context:', {
          error: parseError.message,
          stack: parseError.stack?.split('\n').slice(0, 3),
          rawData: recordingContext?.toString().substring(0, 200)
        });
        // Initialize empty context to continue
        audioData.recordingContext = {};
      }
    }

    // Handle legacy fields for backward compatibility
    if (title && typeof title === 'string') {
      audioData.title = title.substring(0, 100);
    }
    if (notes && typeof notes === 'string') {
      if (!audioData.recordingContext) audioData.recordingContext = {};
      audioData.recordingContext.notes = notes.substring(0, 500);
    }
    if (recordingDate) {
      try {
        audioData.recordingDate = new Date(recordingDate);
      } catch (dateError) {
        console.warn('Invalid recording date provided:', recordingDate);
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
      // Include auto-detected metadata
      audioMetadata: savedRecording.audioMetadata,
      metadataAutoDetected: !!extractedMetadata,
      // ML analysis info
      analysis: {
        queued: analysisQueued,
        queuedAt: queuedAt,
        status: savedRecording.analysisStatus
      }
    };

    const message = analysisQueued 
      ? 'Audio recording uploaded successfully with auto-detected metadata and ML analysis queued'
      : 'Audio recording uploaded successfully with auto-detected metadata (ML analysis can be triggered manually)';

    return sendSuccessResponse(res, 201, message, {
      recording: responseData
    });

  } catch (error) {
    console.error('Error uploading audio recording:', error);
    
    // Cleanup uploaded file if something went wrong
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up failed upload file');
      } catch (cleanupError) {
        console.error('Failed to cleanup file after error:', cleanupError);
      }
    }
    
    return sendErrorResponse(res, 500, 'Failed to upload audio recording', 'UPLOAD_ERROR', {
      error: error.message
    });
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
      allPredictions: Object.fromEntries(recording.mlAnalysis.allPredictions || new Map()),
      // Include AI enhancement data
      aiRecommendation: recording.mlAnalysis.aiRecommendation,
      historySummary: recording.mlAnalysis.historySummary,
      babyAge: recording.mlAnalysis.babyAge
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
      featureShape: recording.mlAnalysis.featureShape,
      // Include AI enhancement data
      aiRecommendation: recording.mlAnalysis.aiRecommendation,
      historySummary: recording.mlAnalysis.historySummary,
      babyAge: recording.mlAnalysis.babyAge
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

/**
 * Stream audio file with proper CORS headers
 * @route GET /api/audio/stream/:id
 * @access Private
 */
const streamAudio = asyncHandler(async (req, res) => {
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
    // Set CORS headers for audio streaming
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'https://suatalk.site',
      'https://www.suatalk.site'
    ];
    
    const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';
    
    res.set({
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'Content-Type': recording.mimeType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });

    // Handle cloud storage URLs
    if (process.env.NODE_ENV === 'production' && recording.filePath.startsWith('http')) {
      // For cloud storage, return signed URL instead of redirecting
      // This avoids CORS issues with redirect
      const fileStorageService = require('../services/fileStorage');
      const signedUrl = await fileStorageService.getSignedUrl(recording.filePath);
      
      if (signedUrl) {
        // Instead of redirecting, return the signed URL in JSON
        // Frontend can then make a direct request to this URL
        return res.json({
          success: true,
          data: {
            streamUrl: signedUrl,
            mimeType: recording.mimeType || 'audio/mpeg',
            filename: recording.originalName || 'audio.mp3',
            duration: recording.duration,
            recordingId: recording._id
          },
          message: 'Stream URL generated successfully'
        });
      } else {
        return sendErrorResponse(res, 500, 'Failed to generate signed URL', 'SIGNED_URL_ERROR');
      }
    }

    // For local file storage
    const fullFilePath = path.resolve(recording.filePath);
    
    if (!fs.existsSync(fullFilePath)) {
      return sendErrorResponse(res, 404, 'Audio file not found on disk', 'FILE_NOT_FOUND');
    }

    const stat = fs.statSync(fullFilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests (for seeking in audio)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize.toString()
      });

      const stream = fs.createReadStream(fullFilePath, { start, end });
      stream.pipe(res);
    } else {
      // Stream entire file
      res.set({
        'Content-Length': fileSize.toString()
      });

      const stream = fs.createReadStream(fullFilePath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Error streaming audio file:', error);
    return sendErrorResponse(res, 500, 'Failed to stream audio file', 'STREAM_ERROR');
  }
});

/**
 * Get streaming URL for audio file (no redirect, CORS-friendly)
 * @route GET /api/audio/stream-url/:id
 * @access Private
 */
const getStreamUrl = asyncHandler(async (req, res) => {
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
    // Handle cloud storage URLs
    if (process.env.NODE_ENV === 'production' && recording.filePath.startsWith('http')) {
      const fileStorageService = require('../services/fileStorage');
      const signedUrl = await fileStorageService.getSignedUrl(recording.filePath);
      
      if (signedUrl) {
        return sendSuccessResponse(res, 200, 'Stream URL generated successfully', {
          streamUrl: signedUrl,
          mimeType: recording.mimeType || 'audio/mpeg',
          filename: recording.originalName || 'audio.mp3',
          duration: recording.duration,
          recordingId: recording._id,
          expiresIn: '1 hour'
        });
      } else {
        return sendErrorResponse(res, 500, 'Failed to generate signed URL', 'SIGNED_URL_ERROR');
      }
    }

    // For local file storage, return the stream endpoint
    const streamUrl = `${req.protocol}://${req.get('host')}/audio/stream/${recordingId}`;
    
    return sendSuccessResponse(res, 200, 'Stream URL generated successfully', {
      streamUrl: streamUrl,
      mimeType: recording.mimeType || 'audio/mpeg',
      filename: recording.originalName || 'audio.mp3',
      duration: recording.duration,
      recordingId: recording._id,
      note: 'This URL requires Authorization header for access'
    });

  } catch (error) {
    console.error('Error generating stream URL:', error);
    return sendErrorResponse(res, 500, 'Failed to generate stream URL', 'STREAM_URL_ERROR');
  }
});

/**
 * Proxy audio file from internal storage (alternative to exposing Minio)
 * @route GET /api/audio/proxy/:id
 * @access Private
 */
const proxyAudioFile = asyncHandler(async (req, res) => {
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
    // Set CORS headers for audio streaming
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'https://suatalk.site',
      'https://www.suatalk.site',
      'https://api.suatalk.site'
    ];
    
    const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';
    
    res.set({
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'Content-Type': recording.mimeType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });

    // Handle cloud storage by downloading and streaming through API
    if (process.env.NODE_ENV === 'production' && recording.filePath.startsWith('http')) {
      const AWS = require('aws-sdk');
      
      // Configure S3 client for internal Minio access
      const s3Client = new AWS.S3({
        endpoint: process.env.MINIO_ENDPOINT || 'http://srv-captain--minio:9000',
        accessKeyId: process.env.MINIO_ACCESS_KEY,
        secretAccessKey: process.env.MINIO_SECRET_KEY,
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
        region: process.env.MINIO_REGION || 'us-east-1'
      });

      // Extract object key from file path
      const bucketName = process.env.MINIO_BUCKET_NAME || 'suatalk-files';
      let objectKey = recording.filePath;
      
      if (recording.filePath.startsWith('http')) {
        const url = new URL(recording.filePath);
        // Extract path and remove leading slash and bucket name
        let pathPart = url.pathname.substring(1); // Remove leading slash
        
        // If path starts with bucket name, remove it (e.g., 'suatalk-files/audio-recordings/...' -> 'audio-recordings/...')
        if (pathPart.startsWith(bucketName + '/')) {
          pathPart = pathPart.substring(bucketName.length + 1);
        }
        
        objectKey = pathPart;
      }

      console.log(`🔄 Proxying audio file from Minio: ${objectKey}`);

      // Handle range requests for audio seeking
      const range = req.headers.range;
      
      if (range) {
        // Get object metadata first to determine size
        const headParams = {
          Bucket: bucketName,
          Key: objectKey
        };
        
        const metadata = await s3Client.headObject(headParams).promise();
        const fileSize = metadata.ContentLength;
        
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        // Get partial object
        const getParams = {
          Bucket: bucketName,
          Key: objectKey,
          Range: `bytes=${start}-${end}`
        };
        
        const data = await s3Client.getObject(getParams).promise();
        
        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize.toString()
        });
        
        res.end(data.Body);
      } else {
        // Stream entire file
        const getParams = {
          Bucket: bucketName,
          Key: objectKey
        };
        
        const stream = s3Client.getObject(getParams).createReadStream();
        
        // Get file size for Content-Length header
        stream.on('httpHeaders', (statusCode, headers) => {
          if (headers['content-length']) {
            res.set('Content-Length', headers['content-length']);
          }
        });
        
        stream.pipe(res);
      }
      
      return;
    }

    // For local file storage (development)
    const path = require('path');
    const fs = require('fs');
    
    const fullFilePath = path.resolve(recording.filePath);
    
    if (!fs.existsSync(fullFilePath)) {
      return sendErrorResponse(res, 404, 'Audio file not found on disk', 'FILE_NOT_FOUND');
    }

    const stat = fs.statSync(fullFilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests (for seeking in audio)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize.toString()
      });

      const stream = fs.createReadStream(fullFilePath, { start, end });
      stream.pipe(res);
    } else {
      // Stream entire file
      res.set({
        'Content-Length': fileSize.toString()
      });

      const stream = fs.createReadStream(fullFilePath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Error proxying audio file:', error);
    return sendErrorResponse(res, 500, 'Failed to stream audio file', 'PROXY_ERROR');
  }
});

module.exports = {
  uploadAudioRecording,
  getAllRecordings,
  getRecordingById,
  getPendingAnalysisRecordings,
  batchTriggerAnalysis,
  deleteRecording,
  cleanupAudioFiles,
  streamAudio,
  getStreamUrl,
  proxyAudioFile
}; 