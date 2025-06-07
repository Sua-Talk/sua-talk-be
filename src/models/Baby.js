const mongoose = require('mongoose');

const babySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Baby name is required'],
    trim: true,
    maxlength: [50, 'Baby name cannot exceed 50 characters']
  },
  birthDate: {
    type: Date,
    required: [true, 'Birth date is required'],
    validate: {
      validator: function(date) {
        const now = new Date();
        const minDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()); // Max 5 years old
        return date <= now && date >= minDate;
      },
      message: 'Birth date must be valid and baby cannot be older than 5 years'
    }
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['male', 'female', 'other', 'prefer-not-to-say'],
      message: 'Gender must be one of: male, female, other, prefer-not-to-say'
    }
  },
  profilePicture: {
    thumbnail: {
      type: String,
      default: null
    },
    medium: {
      type: String,
      default: null
    },
    original: {
      type: String,
      default: null
    }
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Parent ID is required'],
    index: true
  },
  // Additional baby information
  weight: {
    birth: {
      type: Number, // in grams
      min: [500, 'Birth weight must be at least 500g'],
      max: [8000, 'Birth weight cannot exceed 8000g']
    },
    current: {
      type: Number, // in grams
      min: [500, 'Current weight must be at least 500g'],
      max: [50000, 'Current weight cannot exceed 50kg']
    }
  },
  height: {
    birth: {
      type: Number, // in cm
      min: [20, 'Birth height must be at least 20cm'],
      max: [80, 'Birth height cannot exceed 80cm']
    },
    current: {
      type: Number, // in cm
      min: [20, 'Current height must be at least 20cm'],
      max: [200, 'Current height cannot exceed 200cm']
    }
  },
  // Baby preferences and notes
  feedingNotes: {
    type: String,
    maxlength: [500, 'Feeding notes cannot exceed 500 characters']
  },
  sleepNotes: {
    type: String,
    maxlength: [500, 'Sleep notes cannot exceed 500 characters']
  },
  allergies: [{
    type: String,
    trim: true,
    maxlength: [100, 'Allergy description cannot exceed 100 characters']
  }],
  medications: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Medication name cannot exceed 100 characters']
    },
    dosage: {
      type: String,
      maxlength: [50, 'Dosage cannot exceed 50 characters']
    },
    frequency: {
      type: String,
      maxlength: [50, 'Frequency cannot exceed 50 characters']
    }
  }],
  // Activity tracking
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
babySchema.index({ parentId: 1, isActive: 1 });
babySchema.index({ birthDate: 1 });
babySchema.index({ name: 1, parentId: 1 });

// Virtual field for age calculation
babySchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  
  const now = new Date();
  const birth = new Date(this.birthDate);
  
  const diffMs = now - birth;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30.44); // Average days per month
  const years = Math.floor(months / 12);
  
  if (years > 0) {
    return {
      years,
      months: months % 12,
      days: Math.floor((days % 30.44)),
      totalDays: days,
      totalMonths: months
    };
  } else if (months > 0) {
    return {
      years: 0,
      months,
      days: Math.floor((days % 30.44)),
      totalDays: days,
      totalMonths: months
    };
  } else {
    return {
      years: 0,
      months: 0,
      days,
      totalDays: days,
      totalMonths: 0
    };
  }
});

// Virtual field for age in weeks (useful for young babies)
babySchema.virtual('ageInWeeks').get(function() {
  if (!this.birthDate) return null;
  
  const now = new Date();
  const birth = new Date(this.birthDate);
  const diffMs = now - birth;
  const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  
  return weeks;
});

// Static method to find babies by parent
babySchema.statics.findByParent = function(parentId, activeOnly = true) {
  const query = { parentId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ birthDate: -1 }); // Newest first
};

// Static method to find babies by age range
babySchema.statics.findByAgeRange = function(minMonths, maxMonths) {
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth() - minMonths, now.getDate());
  const minDate = new Date(now.getFullYear(), now.getMonth() - maxMonths, now.getDate());
  
  return this.find({
    birthDate: { $gte: minDate, $lte: maxDate },
    isActive: true
  });
};

// Instance method to update weight/height
babySchema.methods.updateMeasurements = function(weight, height) {
  if (weight) this.weight.current = weight;
  if (height) this.height.current = height;
  return this.save();
};

const Baby = mongoose.model('Baby', babySchema);

module.exports = Baby; 