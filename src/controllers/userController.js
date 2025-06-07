const User = require('../models/User');
const { validationResult } = require('express-validator');
const { processAvatar, deleteAvatar, validateImageFile } = require('../services/imageService');
const Baby = require('../models/Baby');
const AudioRecording = require('../models/AudioRecording');

/**
 * Get user profile
 * @route GET /api/users/profile
 * @access Private
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fetch user profile excluding sensitive data
    const user = await User.findById(userId)
      .select('-password -passwordResetToken -passwordResetExpires -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Format response data
    const profileData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      profilePicture: user.profilePicture,
      isEmailVerified: user.isEmailVerified,
      hasOAuth: !!(user.oauth?.google?.id || user.googleId),
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: profileData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { firstName, lastName, phone } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    // Save updated user
    const updatedUser = await user.save();

    // Format response data (exclude sensitive info)
    const profileData = {
      id: updatedUser._id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      phone: updatedUser.phone,
      profilePicture: updatedUser.profilePicture,
      isEmailVerified: updatedUser.isEmailVerified,
      hasOAuth: !!(updatedUser.oauth?.google?.id || updatedUser.googleId),
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: profileData
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Upload and update user avatar
 * @route POST /api/users/upload-avatar
 * @access Private
 */
const uploadUserAvatar = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an avatar image.'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    try {
      // Validate uploaded image
      const validation = await validateImageFile(req.file.path);
      if (!validation.valid) {
        // Delete invalid file
        try {
          await require('fs').promises.unlink(req.file.path);
        } catch (unlinkError) {
          console.warn('Could not delete invalid file:', unlinkError);
        }
        
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // Process the image (resize, optimize)
      const processedImage = await processAvatar(req.file.path, userId);

      // Delete old avatar if exists
      if (user.profilePicture) {
        // Extract filename from URL
        const oldFilename = user.profilePicture.split('/').pop();
        await deleteAvatar(oldFilename);
      }

      // Update user profile with new avatar URL
      user.profilePicture = processedImage.url;
      await user.save();

      // Format response data (same as getProfile)
      const profileData = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        hasOAuth: !!(user.oauth?.google?.id || user.googleId),
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      return res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          user: profileData,
          image: {
            filename: processedImage.filename,
            size: processedImage.size,
            dimensions: `${processedImage.width}x${processedImage.height}`,
            format: processedImage.format
          }
        }
      });

    } catch (imageError) {
      console.error('Image processing error:', imageError);
      
      return res.status(400).json({
        success: false,
        message: imageError.message || 'Failed to process image'
      });
    }

  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await require('fs').promises.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Could not delete uploaded file on error:', unlinkError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete user account
 * @route DELETE /api/users/account
 * @access Private
 */
const deleteAccount = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { password } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password for non-OAuth users
    if (user.password) {
      try {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid password'
          });
        }
      } catch (passwordError) {
        return res.status(400).json({
          success: false,
          message: 'Password verification failed'
        });
      }
    }

    try {
      // Start deletion process
      console.log(`Starting account deletion for user ${userId}`);

      // 1. Delete user's avatar if exists
      if (user.profilePicture) {
        const filename = user.profilePicture.split('/').pop();
        await deleteAvatar(filename);
        console.log(`Deleted avatar for user ${userId}`);
      }

      // 2. Delete associated babies and their data
      const userBabies = await Baby.find({ userId });
      const babyIds = userBabies.map(baby => baby._id);
      
      if (babyIds.length > 0) {
        // Delete audio recordings for all babies
        const deletedRecordings = await AudioRecording.deleteMany({ 
          babyId: { $in: babyIds } 
        });
        console.log(`Deleted ${deletedRecordings.deletedCount} audio recordings for user ${userId}`);

        // Delete babies
        const deletedBabies = await Baby.deleteMany({ userId });
        console.log(`Deleted ${deletedBabies.deletedCount} babies for user ${userId}`);
      }

      // 3. Delete user's audio recordings (if any not linked to babies)
      const deletedUserRecordings = await AudioRecording.deleteMany({ userId });
      console.log(`Deleted ${deletedUserRecordings.deletedCount} additional audio recordings for user ${userId}`);

      // 4. Delete the user account
      await User.findByIdAndDelete(userId);
      console.log(`Deleted user account ${userId}`);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        data: {
          deletedData: {
            user: true,
            babies: babyIds.length,
            audioRecordings: deletedRecordings?.deletedCount + deletedUserRecordings?.deletedCount || 0,
            avatar: !!user.profilePicture
          }
        }
      });

    } catch (deletionError) {
      console.error('Account deletion error:', deletionError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account completely. Please contact support.',
        error: process.env.NODE_ENV === 'development' ? deletionError.message : undefined
      });
    }

  } catch (error) {
    console.error('Delete account error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadUserAvatar,
  deleteAccount
}; 