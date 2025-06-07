const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  code: {
    type: String,
    required: [true, 'OTP code is required'],
    length: [6, 'OTP code must be exactly 6 characters']
  },
  purpose: {
    type: String,
    required: [true, 'OTP purpose is required'],
    enum: {
      values: ['email_verification', 'password_reset', 'login_verification'],
      message: 'Purpose must be one of: email_verification, password_reset, login_verification'
    }
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required']
    // TTL index defined separately below
  },
  // Security metadata
  ipAddress: {
    type: String,
    validate: {
      validator: function(ip) {
        if (!ip) return true; // Optional field
        // Basic IP validation (IPv4 and IPv6)
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
      },
      message: 'Invalid IP address format'
    }
  },
  userAgent: {
    type: String,
    maxlength: [500, 'User agent cannot exceed 500 characters']
  },
  // Tracking
  attemptCount: {
    type: Number,
    default: 0,
    max: [5, 'Maximum 5 verification attempts allowed']
  },
  lastAttemptAt: {
    type: Date
  },
  usedAt: {
    type: Date
  },
  // Rate limiting
  requestCount: {
    type: Number,
    default: 1,
    max: [3, 'Maximum 3 OTP requests per session allowed']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Never expose the actual OTP code in JSON response
      delete ret.code;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance and security
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });
otpSchema.index({ createdAt: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Compound index for finding valid OTPs
otpSchema.index({ 
  email: 1, 
  purpose: 1, 
  isUsed: 1, 
  expiresAt: 1 
});

// Virtual for checking if OTP is expired
otpSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual for checking if OTP is valid (not used and not expired)
otpSchema.virtual('isValid').get(function() {
  return !this.isUsed && !this.isExpired;
});

// Virtual for time remaining until expiration
otpSchema.virtual('timeRemaining').get(function() {
  if (this.isExpired) return 0;
  return Math.max(0, Math.floor((this.expiresAt - new Date()) / 1000)); // in seconds
});

// Static method to generate OTP
otpSchema.statics.generateCode = function(length = 6) {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
};

// Static method to create new OTP
otpSchema.statics.createOTP = async function(email, purpose, options = {}) {
  const {
    expirationMinutes = 5,
    ipAddress = null,
    userAgent = null
  } = options;

  // Invalidate any existing unused OTPs for the same email and purpose
  await this.updateMany(
    { 
      email: email.toLowerCase(), 
      purpose, 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedAt: new Date()
    }
  );

  // Generate new OTP
  const code = this.generateCode();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  const otp = new this({
    email: email.toLowerCase(),
    code,
    purpose,
    expiresAt,
    ipAddress,
    userAgent
  });

  return otp.save();
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, code, purpose) {
  const otp = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otp) {
    return { 
      success: false, 
      error: 'Invalid or expired OTP' 
    };
  }

  // Increment attempt count
  otp.attemptCount += 1;
  otp.lastAttemptAt = new Date();

  // Check if max attempts exceeded
  if (otp.attemptCount > 5) {
    otp.isUsed = true;
    otp.usedAt = new Date();
    await otp.save();
    return { 
      success: false, 
      error: 'Maximum verification attempts exceeded' 
    };
  }

  // Verify code
  if (otp.code !== code) {
    await otp.save();
    return { 
      success: false, 
      error: 'Invalid OTP code',
      attemptsRemaining: Math.max(0, 5 - otp.attemptCount)
    };
  }

  // Mark as used
  otp.isUsed = true;
  otp.usedAt = new Date();
  await otp.save();

  return { 
    success: true, 
    otp,
    message: 'OTP verified successfully' 
  };
};

// Static method to check rate limiting
otpSchema.statics.checkRateLimit = async function(email, purpose, timeWindowMinutes = 15) {
  const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  const recentOtpCount = await this.countDocuments({
    email: email.toLowerCase(),
    purpose,
    createdAt: { $gte: since }
  });

  const maxRequestsPerWindow = 3;
  
  return {
    allowed: recentOtpCount < maxRequestsPerWindow,
    requestsInWindow: recentOtpCount,
    maxRequests: maxRequestsPerWindow,
    resetAt: new Date(Date.now() + timeWindowMinutes * 60 * 1000)
  };
};

// Static method to cleanup expired OTPs (manual cleanup if TTL doesn't work)
otpSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return {
    deletedCount: result.deletedCount,
    cleanupAt: new Date()
  };
};

// Instance method to extend expiration
otpSchema.methods.extend = function(minutes = 5) {
  if (this.isUsed) {
    throw new Error('Cannot extend used OTP');
  }
  
  this.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  return this.save();
};

// Instance method to mark as used
otpSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  this.usedAt = new Date();
  return this.save();
};

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP; 