const mongoose = require('mongoose');

const audioRecordingSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  filePath: {
    type: String,
    required: [true, 'File path is required'],
    trim: true
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [52428800, 'File size cannot exceed 50MB'] // 50MB in bytes
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    enum: {
      values: ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/flac'],
      message: 'File type must be one of: wav, mp3, m4a, flac'
    }
  },
  duration: {
    type: Number, // in seconds
    min: [0.1, 'Duration must be at least 0.1 seconds'],
    max: [300, 'Duration cannot exceed 5 minutes'] // 5 minutes max
  },
  babyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Baby',
    required: [true, 'Baby ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  // ML Analysis Results
  analysisStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  emotionResult: {
    prediction: {
      type: String,
      enum: ['burping', 'discomfort', 'belly_pain', 'hungry', 'tired'],
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    allPredictions: [{
      emotion: {
        type: String,
        enum: ['burping', 'discomfort', 'belly_pain', 'hungry', 'tired']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    }]
  },
  // ML Service metadata
  mlServiceResponse: {
    modelVersion: String,
    processingTime: Number, // in milliseconds
    requestId: String,
    error: String
  },
  // Audio metadata
  audioMetadata: {
    sampleRate: Number,
    bitRate: Number,
    channels: Number,
    encoding: String
  },
  // Analysis metadata
  analysisMetadata: {
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    analyzedAt: Date,
    retryCount: {
      type: Number,
      default: 0,
      max: 3
    },
    lastRetryAt: Date
  },
  // Recording context
  recordingContext: {
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      default: null
    },
    beforeFeeding: {
      type: Boolean,
      default: null
    },
    afterFeeding: {
      type: Boolean,
      default: null
    },
    beforeSleep: {
      type: Boolean,
      default: null
    },
    afterSleep: {
      type: Boolean,
      default: null
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
audioRecordingSchema.index({ userId: 1, createdAt: -1 });
audioRecordingSchema.index({ babyId: 1, createdAt: -1 });
audioRecordingSchema.index({ analysisStatus: 1 });
audioRecordingSchema.index({ 'emotionResult.prediction': 1 });
audioRecordingSchema.index({ createdAt: -1 });

// Compound indexes
audioRecordingSchema.index({ userId: 1, babyId: 1, createdAt: -1 });
audioRecordingSchema.index({ analysisStatus: 1, 'analysisMetadata.retryCount': 1 });

// Virtual for file URL (if using cloud storage)
audioRecordingSchema.virtual('fileUrl').get(function() {
  if (process.env.NODE_ENV === 'production' && process.env.CLOUD_STORAGE_BASE_URL) {
    return `${process.env.CLOUD_STORAGE_BASE_URL}/${this.filePath}`;
  }
  return `${process.env.APP_URL}/uploads/${this.filename}`;
});

// Virtual for human-readable file size
audioRecordingSchema.virtual('fileSizeFormatted').get(function() {
  const size = this.fileSize;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
});

// Virtual for human-readable duration
audioRecordingSchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return null;
  const minutes = Math.floor(this.duration / 60);
  const seconds = Math.floor(this.duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Static method to find by user
audioRecordingSchema.statics.findByUser = function(userId, limit = 50) {
  return this.find({ userId, isActive: true })
    .populate('babyId', 'name birthDate')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find by baby
audioRecordingSchema.statics.findByBaby = function(babyId, limit = 50) {
  return this.find({ babyId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find pending analysis
audioRecordingSchema.statics.findPendingAnalysis = function() {
  return this.find({ 
    analysisStatus: { $in: ['pending', 'processing'] },
    'analysisMetadata.retryCount': { $lt: 3 }
  }).sort({ createdAt: 1 });
};

// Static method to find by emotion
audioRecordingSchema.statics.findByEmotion = function(emotion, userId, limit = 20) {
  return this.find({ 
    'emotionResult.prediction': emotion,
    userId,
    isActive: true 
  })
    .populate('babyId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to update analysis result
audioRecordingSchema.methods.updateAnalysisResult = function(result) {
  this.analysisStatus = 'completed';
  this.emotionResult = result;
  this.analysisMetadata.analyzedAt = new Date();
  return this.save();
};

// Instance method to mark analysis as failed
audioRecordingSchema.methods.markAnalysisFailed = function(error) {
  this.analysisStatus = 'failed';
  this.mlServiceResponse.error = error;
  this.analysisMetadata.retryCount += 1;
  this.analysisMetadata.lastRetryAt = new Date();
  return this.save();
};

const AudioRecording = mongoose.model('AudioRecording', audioRecordingSchema);

module.exports = AudioRecording; 