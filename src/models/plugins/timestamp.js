/**
 * Timestamp Plugin for Mongoose Models
 * Adds createdAt and updatedAt fields to schemas
 * Note: This is mainly for reference since most models use the built-in timestamps option
 */

const timestampPlugin = function(schema, options) {
  const defaults = {
    createdAtField: 'createdAt',
    updatedAtField: 'updatedAt',
    index: true
  };

  const settings = Object.assign(defaults, options);

  // Add timestamp fields
  schema.add({
    [settings.createdAtField]: {
      type: Date,
      default: Date.now,
      index: settings.index
    },
    [settings.updatedAtField]: {
      type: Date,
      default: Date.now,
      index: settings.index
    }
  });

  // Update the updatedAt field on save
  schema.pre('save', function(next) {
    if (this.isNew) {
      this[settings.createdAtField] = this[settings.updatedAtField] = new Date();
    } else {
      this[settings.updatedAtField] = new Date();
    }
    next();
  });

  // Update the updatedAt field on findOneAndUpdate
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function() {
    this.set({ [settings.updatedAtField]: new Date() });
  });

  // Add virtual for formatted timestamps
  schema.virtual('timestampsFormatted').get(function() {
    return {
      createdAt: this[settings.createdAtField]?.toLocaleString(),
      updatedAt: this[settings.updatedAtField]?.toLocaleString(),
      timeAgo: {
        created: getTimeAgo(this[settings.createdAtField]),
        updated: getTimeAgo(this[settings.updatedAtField])
      }
    };
  });
};

// Helper function to get time ago format
function getTimeAgo(date) {
  if (!date) return null;
  
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffSecs > 0) return `${diffSecs} second${diffSecs > 1 ? 's' : ''} ago`;
  return 'just now';
}

module.exports = timestampPlugin; 