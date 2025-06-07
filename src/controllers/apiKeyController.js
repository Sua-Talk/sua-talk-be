const APIKey = require('../models/APIKey');
const { validationResult } = require('express-validator');

/**
 * Create a new API key
 */
const createAPIKey = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      permissions,
      type = 'user',
      expiresAt,
      allowedIPs = [],
      rateLimitPerHour,
      rateLimitPerDay
    } = req.body;

    // Generate API key pair
    const { fullKey, prefix } = APIKey.generateKeyPair();
    const keyHash = APIKey.hashKey(fullKey);

    // Create API key document
    const apiKeyData = {
      name,
      description,
      keyHash,
      keyPrefix: prefix,
      permissions,
      type,
      allowedIPs,
      environment: process.env.NODE_ENV || 'development'
    };

    // Set owner for user-type keys
    if (type === 'user' && req.user) {
      apiKeyData.createdBy = req.user._id;
    }

    // Set expiration
    if (expiresAt) {
      apiKeyData.expiresAt = new Date(expiresAt);
    }

    // Set custom rate limits
    if (rateLimitPerHour) {
      apiKeyData.rateLimitPerHour = rateLimitPerHour;
    }
    if (rateLimitPerDay) {
      apiKeyData.rateLimitPerDay = rateLimitPerDay;
    }

    const apiKey = new APIKey(apiKeyData);
    await apiKey.save();

    // Return the API key (only time the full key is shown)
    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        apiKey: {
          ...apiKey.toJSON(),
          fullKey // Include the full key only in the creation response
        }
      },
      warning: 'Store this API key securely. It will not be shown again.'
    });

  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create API key',
      error: error.message
    });
  }
};

/**
 * List API keys for the authenticated user
 */
const listAPIKeys = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      isActive,
      search
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by owner for user-type keys
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      query.createdBy = req.user._id;
    }

    // Apply filters
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Search in name and description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: 'createdBy',
        select: 'name email'
      }
    };

    const result = await APIKey.paginate(query, options);

    res.json({
      success: true,
      data: {
        apiKeys: result.docs,
        pagination: {
          page: result.page,
          pages: result.totalPages,
          total: result.totalDocs,
          limit: result.limit
        }
      }
    });

  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list API keys',
      error: error.message
    });
  }
};

/**
 * Get API key details by ID
 */
const getAPIKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await APIKey.findById(id).populate('createdBy', 'name email');
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      if (!apiKey.createdBy || apiKey.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: { apiKey }
    });

  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get API key',
      error: error.message
    });
  }
};

/**
 * Update API key
 */
const updateAPIKey = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.keyHash;
    delete updates.keyPrefix;
    delete updates.createdBy;

    const apiKey = await APIKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      if (!apiKey.createdBy || apiKey.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Apply updates
    Object.assign(apiKey, updates);
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: { apiKey }
    });

  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update API key',
      error: error.message
    });
  }
};

/**
 * Revoke (deactivate) API key
 */
const revokeAPIKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await APIKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      if (!apiKey.createdBy || apiKey.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    apiKey.isActive = false;
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key revoked successfully',
      data: { apiKey }
    });

  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke API key',
      error: error.message
    });
  }
};

/**
 * Delete API key permanently
 */
const deleteAPIKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await APIKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      if (!apiKey.createdBy || apiKey.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await APIKey.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });

  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete API key',
      error: error.message
    });
  }
};

/**
 * Get API key usage statistics
 */
const getAPIKeyStats = async (req, res) => {
  try {
    const query = {};
    
    // Filter by owner if not admin
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      query.createdBy = req.user._id;
    }

    const stats = await APIKey.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalKeys: { $sum: 1 },
          activeKeys: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          expiredKeys: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$expiresAt', null] },
                    { $lt: ['$expiresAt', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalUsage: { $sum: '$usageCount' },
          lastUsed: { $max: '$lastUsedAt' }
        }
      }
    ]);

    const result = stats[0] || {
      totalKeys: 0,
      activeKeys: 0,
      expiredKeys: 0,
      totalUsage: 0,
      lastUsed: null
    };

    res.json({
      success: true,
      data: { stats: result }
    });

  } catch (error) {
    console.error('Get API key stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get API key statistics',
      error: error.message
    });
  }
};

/**
 * Rotate API key (generate new key, keep metadata)
 */
const rotateAPIKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await APIKey.findById(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user && !req.apiKey?.hasPermission('admin:manage')) {
      if (!apiKey.createdBy || apiKey.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Generate new key
    const { fullKey, prefix } = APIKey.generateKeyPair();
    const keyHash = APIKey.hashKey(fullKey);

    // Update the API key
    apiKey.keyHash = keyHash;
    apiKey.keyPrefix = prefix;
    apiKey.usageCount = 0; // Reset usage count
    apiKey.lastUsedAt = null; // Reset last used
    
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key rotated successfully',
      data: {
        apiKey: {
          ...apiKey.toJSON(),
          fullKey // Include the new full key
        }
      },
      warning: 'Store this new API key securely. The old key is now invalid.'
    });

  } catch (error) {
    console.error('Rotate API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rotate API key',
      error: error.message
    });
  }
};

module.exports = {
  createAPIKey,
  listAPIKeys,
  getAPIKey,
  updateAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  getAPIKeyStats,
  rotateAPIKey
}; 