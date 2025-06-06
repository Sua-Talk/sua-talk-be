const mongoose = require('mongoose');

// Import all models
const User = require('./User');
const Baby = require('./Baby');
const AudioRecording = require('./AudioRecording');
const OTP = require('./OTP');

// Common plugins
const timestampPlugin = require('./plugins/timestamp');
const softDeletePlugin = require('./plugins/softDelete');

// Apply common plugins to all models
const applyCommonPlugins = () => {
  // Note: We're not applying timestamp plugin since it's already handled
  // by mongoose timestamps: true option in each schema
  
  // Apply soft delete plugin to models that need it
  // (excluding OTP since it has TTL auto-expiration)
  User.schema.plugin(softDeletePlugin);
  Baby.schema.plugin(softDeletePlugin);
  AudioRecording.schema.plugin(softDeletePlugin);
};

// Initialize plugins
applyCommonPlugins();

// Database connection events logging
mongoose.connection.on('connected', () => {
  console.log('📦 Models initialized and plugins applied');
});

// Export all models
module.exports = {
  User,
  Baby,
  AudioRecording,
  OTP,
  // Helper function to get all model names
  getModelNames: () => ['User', 'Baby', 'AudioRecording', 'OTP'],
  // Helper function to check if all models are ready
  areModelsReady: () => {
    const modelNames = ['User', 'Baby', 'AudioRecording', 'OTP'];
    return modelNames.every(name => mongoose.models[name]);
  }
}; 