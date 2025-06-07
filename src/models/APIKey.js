const mongoose = require('mongoose');
const crypto = require('crypto');
const mongoosePaginate = require('mongoose-paginate-v2');

const apiKeySchema = new mongoose.Schema({
  // API Key information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Key data (hashed for security)
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  
  // Permissions and scopes
  permissions: [{
    type: String,
    enum: [
      'ml:read',           // Read ML analysis results
      'ml:write',          // Submit ML analysis requests
      'audio:read',        // Read audio recordings
      'audio:write',       // Upload audio recordings
      'users:read',        // Read user data
      'admin:manage',      // Administrative operations
      'internal:service'   // Internal service communication
    ]
  }],
  
  // Owner information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'user';
    }
  },
  
  // API Key type
  type: {
    type: String,
    enum: ['user', 'service', 'admin'],
    required: true,
    default: 'user'
  },
  
  // Status and lifecycle
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  lastUsedAt: {
    type: Date
  },
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Rate limiting
  rateLimitPerHour: {
    type: Number,
    default: 1000
  },
  rateLimitPerDay: {
    type: Number,
    default: 10000
  },
  
  // IP restrictions
  allowedIPs: [{
    type: String,
    validate: {
      validator: function(ip) {
        // Basic IP validation (supports both IPv4 and IPv6)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost';
      },
      message: 'Invalid IP address format'
    }
  }],
  
  // Security metadata
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: process.env.NODE_ENV || 'development'
  }
}, {
  timestamps: true
});

// Add pagination plugin
apiKeySchema.plugin(mongoosePaginate);

// Indexes for performance
apiKeySchema.index({ keyHash: 1, isActive: 1 });
apiKeySchema.index({ createdBy: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
apiKeySchema.index({ type: 1, isActive: 1 });

// Generate API key pair (prefix + secret)
apiKeySchema.statics.generateKeyPair = function() {
  const prefix = 'sk_' + crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const fullKey = prefix + '_' + secret;
  
  return {
    fullKey,
    prefix,
    secret
  };
};

// Hash API key for storage
apiKeySchema.statics.hashKey = function(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// Verify API key
apiKeySchema.methods.verifyKey = function(providedKey) {
  const hashedProvidedKey = this.constructor.hashKey(providedKey);
  return hashedProvidedKey === this.keyHash;
};

// Check if API key has permission
apiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.permissions.includes('admin:manage');
};

// Check if API key is expired
apiKeySchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Check if IP is allowed
apiKeySchema.methods.isIPAllowed = function(ip) {
  if (this.allowedIPs.length === 0) return true;
  return this.allowedIPs.includes(ip) || this.allowedIPs.includes('0.0.0.0');
};

// Update usage statistics
apiKeySchema.methods.recordUsage = function() {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  return this.save();
};

// Validate before save
apiKeySchema.pre('save', function(next) {
  // Ensure at least one permission is set
  if (this.permissions.length === 0) {
    const error = new Error('API key must have at least one permission');
    return next(error);
  }
  
  // Set default expiration if not provided (1 year for user keys, never for service keys)
  if (!this.expiresAt) {
    if (this.type === 'service') {
      // Service keys don't expire by default
      this.expiresAt = null;
    } else {
      // User keys expire in 1 year
      this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
  }
  
  next();
});

// Clean expired keys periodically
apiKeySchema.statics.cleanExpiredKeys = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
    isActive: false
  });
  
  console.log(`🧹 Cleaned ${result.deletedCount} expired API keys`);
  return result;
};

// Virtual for masked key display
apiKeySchema.virtual('maskedKey').get(function() {
  return this.keyPrefix + '_' + '*'.repeat(32);
});

// Transform output to hide sensitive data
apiKeySchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.keyHash;
  obj.maskedKey = this.maskedKey;
  return obj;
};

const APIKey = mongoose.model('APIKey', apiKeySchema);

module.exports = APIKey; 