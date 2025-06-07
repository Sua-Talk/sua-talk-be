const Baby = require('../models/Baby');
const { sendSuccessResponse, sendErrorResponse, asyncHandler } = require('../middleware/errorHandler');

/**
 * Create new baby profile
 * @route POST /api/babies
 * @access Private
 */
const createBaby = asyncHandler(async (req, res) => {

    const userId = req.user._id;
    const { name, birthDate, gender, weight, height, feedingNotes, sleepNotes, allergies, medications } = req.body;

    // Check if user has permission to create babies
    if (!req.user.isActive) {
      return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    // Create baby profile data
    const babyData = {
      name,
      birthDate,
      gender,
      parentId: userId
    };

    // Add optional fields if provided
    if (weight) {
      babyData.weight = {};
      if (weight.birth) babyData.weight.birth = weight.birth;
      if (weight.current) babyData.weight.current = weight.current;
    }

    if (height) {
      babyData.height = {};
      if (height.birth) babyData.height.birth = height.birth;
      if (height.current) babyData.height.current = height.current;
    }

    if (feedingNotes) babyData.feedingNotes = feedingNotes;
    if (sleepNotes) babyData.sleepNotes = sleepNotes;
    if (allergies && Array.isArray(allergies)) babyData.allergies = allergies;
    if (medications && Array.isArray(medications)) babyData.medications = medications;

    // Create baby profile in database
    const baby = new Baby(babyData);
    const savedBaby = await baby.save();

    // Format response data
    const responseData = {
      id: savedBaby._id,
      name: savedBaby.name,
      birthDate: savedBaby.birthDate,
      gender: savedBaby.gender,
      profilePicture: savedBaby.profilePicture,
      weight: savedBaby.weight,
      height: savedBaby.height,
      feedingNotes: savedBaby.feedingNotes,
      sleepNotes: savedBaby.sleepNotes,
      allergies: savedBaby.allergies,
      medications: savedBaby.medications,
      age: savedBaby.age,
      ageInWeeks: savedBaby.ageInWeeks,
      isActive: savedBaby.isActive,
      createdAt: savedBaby.createdAt,
      updatedAt: savedBaby.updatedAt
    };

    return sendSuccessResponse(res, 201, 'Baby profile created successfully', {
      baby: responseData
    });
});

/**
 * Get all baby profiles for authenticated user
 * @route GET /api/babies
 * @access Private
 */
const getAllBabies = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

    // Fetch all babies for the authenticated user using static method
    const babies = await Baby.findByParent(userId, true);

    // Format response data
    const responseData = babies.map(baby => ({
      id: baby._id,
      name: baby.name,
      birthDate: baby.birthDate,
      gender: baby.gender,
      profilePicture: baby.profilePicture,
      weight: baby.weight,
      height: baby.height,
      feedingNotes: baby.feedingNotes,
      sleepNotes: baby.sleepNotes,
      allergies: baby.allergies,
      medications: baby.medications,
      age: baby.age,
      ageInWeeks: baby.ageInWeeks,
      isActive: baby.isActive,
      createdAt: baby.createdAt,
      updatedAt: baby.updatedAt
    }));

  return sendSuccessResponse(res, 200, 'Baby profiles retrieved successfully', {
    babies: responseData,
    count: responseData.length
  });
});

/**
 * Get specific baby profile by ID
 * @route GET /api/babies/:id
 * @access Private
 */
const getBabyById = asyncHandler(async (req, res) => {
  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

    // Baby is already verified and attached by requireBabyOwnership middleware
    const baby = req.baby;

    // Format response data
    const responseData = {
      id: baby._id,
      name: baby.name,
      birthDate: baby.birthDate,
      gender: baby.gender,
      profilePicture: baby.profilePicture,
      weight: baby.weight,
      height: baby.height,
      feedingNotes: baby.feedingNotes,
      sleepNotes: baby.sleepNotes,
      allergies: baby.allergies,
      medications: baby.medications,
      age: baby.age,
      ageInWeeks: baby.ageInWeeks,
      isActive: baby.isActive,
      createdAt: baby.createdAt,
      updatedAt: baby.updatedAt
    };

  return sendSuccessResponse(res, 200, 'Baby profile retrieved successfully', {
    baby: responseData
  });
});

/**
 * Update baby profile
 * @route PUT /api/babies/:id
 * @access Private
 */
const updateBaby = asyncHandler(async (req, res) => {
  const { name, birthDate, gender, weight, height, feedingNotes, sleepNotes, allergies, medications } = req.body;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

    // Baby is already verified and attached by requireBabyOwnership middleware
    const baby = req.baby;

    // Update fields if provided
    if (name !== undefined) baby.name = name;
    if (birthDate !== undefined) baby.birthDate = birthDate;
    if (gender !== undefined) baby.gender = gender;
    if (feedingNotes !== undefined) baby.feedingNotes = feedingNotes;
    if (sleepNotes !== undefined) baby.sleepNotes = sleepNotes;
    if (allergies !== undefined && Array.isArray(allergies)) baby.allergies = allergies;
    if (medications !== undefined && Array.isArray(medications)) baby.medications = medications;

    // Handle weight updates
    if (weight) {
      if (!baby.weight) baby.weight = {};
      if (weight.birth !== undefined) baby.weight.birth = weight.birth;
      if (weight.current !== undefined) baby.weight.current = weight.current;
    }

    // Handle height updates
    if (height) {
      if (!baby.height) baby.height = {};
      if (height.birth !== undefined) baby.height.birth = height.birth;
      if (height.current !== undefined) baby.height.current = height.current;
    }

    // Save updated baby
    const updatedBaby = await baby.save();

    // Format response data
    const responseData = {
      id: updatedBaby._id,
      name: updatedBaby.name,
      birthDate: updatedBaby.birthDate,
      gender: updatedBaby.gender,
      profilePicture: updatedBaby.profilePicture,
      weight: updatedBaby.weight,
      height: updatedBaby.height,
      feedingNotes: updatedBaby.feedingNotes,
      sleepNotes: updatedBaby.sleepNotes,
      allergies: updatedBaby.allergies,
      medications: updatedBaby.medications,
      age: updatedBaby.age,
      ageInWeeks: updatedBaby.ageInWeeks,
      isActive: updatedBaby.isActive,
      createdAt: updatedBaby.createdAt,
      updatedAt: updatedBaby.updatedAt
    };

  return sendSuccessResponse(res, 200, 'Baby profile updated successfully', {
    baby: responseData
  });
});

/**
 * Delete baby profile (soft delete)
 * @route DELETE /api/babies/:id
 * @access Private
 */
const deleteBaby = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

    // Baby is already verified and attached by requireBabyOwnership middleware
    const baby = req.baby;

    // Perform soft delete using the plugin method
    await baby.softDelete(userId);

  return sendSuccessResponse(res, 200, 'Baby profile deleted successfully', {
    deletedBabyId: baby._id
  });
});

/**
 * Upload baby photo
 * @route POST /api/babies/:id/upload-photo
 * @access Private
 */
const uploadBabyPhoto = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if account is active
  if (!req.user.isActive) {
    return sendErrorResponse(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Check if file was uploaded
  if (!req.file) {
    return sendErrorResponse(res, 400, 'No photo file provided', 'NO_FILE_UPLOADED');
  }

  try {
    // Baby is already verified and attached by requireBabyOwnership middleware
    const baby = req.baby;

    // Import image processing utilities
    const { processBabyPhoto, deleteBabyPhoto, validateImage } = require('../utils/imageProcessor');
    const { babyPhotosDir } = require('../middleware/upload');

    try {
      // Validate the uploaded image
      await validateImage(req.file.path);

      // Process the uploaded image
      const processResult = await processBabyPhoto(
        req.file.path,
        babyPhotosDir,
        req.file.filename
      );

      // Delete old photos if they exist
      if (baby.profilePicture && Object.keys(baby.profilePicture).length > 0) {
        await deleteBabyPhoto(baby.profilePicture);
      }

      // Update baby profile with new photo paths
      baby.profilePicture = {
        thumbnail: processResult.paths.thumbnail,
        medium: processResult.paths.medium,
        original: processResult.paths.original
      };

      // Save updated baby profile
      const updatedBaby = await baby.save();

      // Format response data
      const responseData = {
        id: updatedBaby._id,
        name: updatedBaby.name,
        profilePicture: updatedBaby.profilePicture,
        photoProcessing: {
          sizes: processResult.sizes,
          message: 'Photo processed successfully'
        }
      };

      return res.status(200).json({
        success: true,
        message: 'Baby photo uploaded and processed successfully',
        data: {
          baby: responseData
        }
      });

    } catch (imageError) {
      console.error('Image processing error:', imageError);
      
      // Clean up uploaded file if processing failed
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up uploaded file:', unlinkError);
      }

      return res.status(400).json({
        success: false,
        message: imageError.message,
        error: 'IMAGE_PROCESSING_FAILED'
      });
    }

  } catch (error) {
    console.error('Upload baby photo error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up uploaded file:', unlinkError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Delete baby photo
 * @route DELETE /api/babies/:id/photo
 * @access Private
 */
const deleteBabyPhotoEndpoint = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if account is active
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Baby is already verified and attached by requireBabyOwnership middleware
    const baby = req.baby;

    // Check if baby has a photo
    if (!baby.profilePicture || Object.keys(baby.profilePicture).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No photo found for this baby profile',
        error: 'NO_PHOTO_FOUND'
      });
    }

    // Import image processing utilities
    const { deleteBabyPhoto: deletePhotoFiles } = require('../utils/imageProcessor');

    try {
      // Delete photo files from filesystem
      await deletePhotoFiles(baby.profilePicture);

      // Clear photo paths from database
      baby.profilePicture = {
        thumbnail: null,
        medium: null,
        original: null
      };

      // Save updated baby profile
      const updatedBaby = await baby.save();

      // Format response data
      const responseData = {
        id: updatedBaby._id,
        name: updatedBaby.name,
        profilePicture: updatedBaby.profilePicture
      };

      return res.status(200).json({
        success: true,
        message: 'Baby photo deleted successfully',
        data: {
          baby: responseData
        }
      });

    } catch (deleteError) {
      console.error('Photo deletion error:', deleteError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to delete photo files',
        error: 'PHOTO_DELETION_FAILED'
      });
    }

  } catch (error) {
    console.error('Delete baby photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createBaby,
  getAllBabies,
  getBabyById,
  updateBaby,
  deleteBaby,
  uploadBabyPhoto,
  deleteBabyPhoto: deleteBabyPhotoEndpoint
}; 