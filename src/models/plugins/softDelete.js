/**
 * Soft Delete Plugin for Mongoose Models
 * Adds soft delete functionality to schemas
 */

const softDeletePlugin = function(schema, options) {
  const defaults = {
    deletedField: 'deletedAt',
    deletedByField: 'deletedBy',
    indexFields: true,
    validateBeforeDelete: true
  };

  const settings = Object.assign(defaults, options);

  // Add soft delete fields
  schema.add({
    [settings.deletedField]: {
      type: Date,
      default: null,
      index: settings.indexFields
    },
    [settings.deletedByField]: {
      type: schema.paths.userId ? schema.paths.userId.instance : String,
      default: null,
      ref: 'User'
    }
  });

  // Virtual for checking if document is deleted
  schema.virtual('isDeleted').get(function() {
    return !!this[settings.deletedField];
  });

  // Virtual for checking if document is active (only if not already exists)
  if (!schema.paths.isActive && !schema.virtuals.isActive) {
    schema.virtual('isActive').get(function() {
      return !this[settings.deletedField];
    });
  }

  // Instance method for soft delete
  schema.methods.softDelete = function(deletedBy = null, callback) {
    this[settings.deletedField] = new Date();
    if (deletedBy) {
      this[settings.deletedByField] = deletedBy;
    }
    
    if (callback) {
      return this.save(callback);
    }
    return this.save();
  };

  // Instance method for restore
  schema.methods.restore = function(callback) {
    this[settings.deletedField] = null;
    this[settings.deletedByField] = null;
    
    if (callback) {
      return this.save(callback);
    }
    return this.save();
  };

  // Static method to find non-deleted documents
  schema.statics.findActive = function(filter = {}, options = {}) {
    const query = {
      ...filter,
      [settings.deletedField]: null
    };
    return this.find(query, null, options);
  };

  // Static method to find deleted documents
  schema.statics.findDeleted = function(filter = {}, options = {}) {
    const query = {
      ...filter,
      [settings.deletedField]: { $ne: null }
    };
    return this.find(query, null, options);
  };

  // Static method to find with deleted documents included
  schema.statics.findWithDeleted = function(filter = {}, options = {}) {
    return this.find(filter, null, options);
  };

  // Static method for bulk soft delete
  schema.statics.softDeleteMany = function(filter, deletedBy = null) {
    const update = {
      [settings.deletedField]: new Date()
    };
    
    if (deletedBy) {
      update[settings.deletedByField] = deletedBy;
    }

    return this.updateMany(filter, update);
  };

  // Static method for bulk restore
  schema.statics.restoreMany = function(filter) {
    const update = {
      [settings.deletedField]: null,
      [settings.deletedByField]: null
    };

    return this.updateMany(filter, update);
  };

  // Override default find methods to exclude deleted documents
  const excludeDeletedQuery = function() {
    if (!this.getQuery()[settings.deletedField]) {
      this.where({ [settings.deletedField]: null });
    }
  };

  // Apply to find methods
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], excludeDeletedQuery);

  // Don't apply to these methods to allow explicit querying
  // 'findById', 'findByIdAndUpdate', 'findByIdAndDelete'

  // Override delete methods to use soft delete
  schema.methods.remove = schema.methods.softDelete;
  schema.methods.delete = schema.methods.softDelete;

  // Add compound index for performance
  if (settings.indexFields) {
    const indexObj = {};
    indexObj[settings.deletedField] = 1;
    indexObj.createdAt = -1; // Assuming createdAt exists
    schema.index(indexObj);
  }
};

module.exports = softDeletePlugin; 