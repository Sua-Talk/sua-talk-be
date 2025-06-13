const mongoose = require('mongoose');
const crypto = require('crypto');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  token: {
    type: String,
    required: [true, 'Token is required'],
    unique: true
  },
  type: {
    type: String,
    required: [true, 'Token type is required'],
    enum: {
      values: ['refresh', 'reset'],
      message: 'Token type must be either refresh or reset'
    }
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
  // Token usage tracking
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  // For refresh token rotation
  replacedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Never expose the actual token in JSON response
      delete ret.token;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance and security
tokenSchema.index({ userId: 1, type: 1, isUsed: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
tokenSchema.index({ createdAt: 1 });

// Compound index for finding valid tokens
tokenSchema.index({ 
  userId: 1, 
  type: 1, 
  isUsed: 1, 
  expiresAt: 1 
});

// Virtual for checking if token is expired
tokenSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual for checking if token is valid (not used and not expired)
tokenSchema.virtual('isValid').get(function() {
  return !this.isUsed && !this.isExpired;
});

// Virtual for time remaining until expiration
tokenSchema.virtual('timeRemaining').get(function() {
  if (this.isExpired) return 0;
  return Math.max(0, Math.floor((this.expiresAt - new Date()) / 1000)); // in seconds
});

// Static method to generate secure token
tokenSchema.statics.generateToken = function(length = 32) {
  return crypto.randomBytes(length).toString('hex');
};

// Static method to create refresh token
tokenSchema.statics.createRefreshToken = async function(userId, options = {}) {
  const {
    expirationDays = 30,
    ipAddress = null,
    userAgent = null
  } = options;

  // Invalidate existing refresh tokens for this user
  await this.updateMany(
    { 
      userId, 
      type: 'refresh', 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedAt: new Date()
    }
  );

  // Generate new refresh token
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

  const refreshToken = new this({
    userId,
    token,
    type: 'refresh',
    expiresAt,
    ipAddress,
    userAgent
  });

  return refreshToken.save();
};

// Static method to create reset token
tokenSchema.statics.createResetToken = async function(userId, options = {}) {
  const {
    expirationHours = 1,
    ipAddress = null,
    userAgent = null
  } = options;

  // Invalidate existing reset tokens for this user
  await this.updateMany(
    { 
      userId, 
      type: 'reset', 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedAt: new Date()
    }
  );

  // Generate new reset token
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  const resetToken = new this({
    userId,
    token,
    type: 'reset',
    expiresAt,
    ipAddress,
    userAgent
  });

  return resetToken.save();
};

// Static method to verify and use token
tokenSchema.statics.verifyAndUseToken = async function(tokenValue, type, userId = null) {
  const query = {
    token: tokenValue,
    type,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  };

  if (userId) {
    query.userId = userId;
  }

  const token = await this.findOne(query).populate('userId');

  if (!token) {
    return { 
      success: false, 
      error: 'Invalid or expired token' 
    };
  }

  // Mark token as used
  token.isUsed = true;
  token.usedAt = new Date();
  await token.save();

  return { 
    success: true, 
    token,
    user: token.userId
  };
};

// Static method to rotate refresh token
tokenSchema.statics.rotateRefreshToken = async function(oldTokenValue, options = {}) {
  const oldTokenResult = await this.verifyAndUseToken(oldTokenValue, 'refresh');
  
  if (!oldTokenResult.success) {
    return oldTokenResult;
  }

  // Create new refresh token
  const newToken = await this.createRefreshToken(oldTokenResult.user._id, options);
  
  // Link old token to new token
  oldTokenResult.token.replacedBy = newToken._id;
  await oldTokenResult.token.save();

  return {
    success: true,
    newToken,
    user: oldTokenResult.user
  };
};

// Static method to cleanup expired tokens
tokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return {
    deletedCount: result.deletedCount,
    cleanupAt: new Date()
  };
};

// Instance method to invalidate token
tokenSchema.methods.invalidate = async function() {
  // Use findOneAndUpdate to avoid parallel save issues
  const updated = await this.constructor.findOneAndUpdate(
    { _id: this._id, isUsed: false },
    { 
      isUsed: true,
      usedAt: new Date()
    },
    { new: true }
  );
  
  if (updated) {
    this.isUsed = true;
    this.usedAt = updated.usedAt;
  }
  
  return this;
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token; 