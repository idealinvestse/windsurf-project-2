const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validateFileUpload } = require('../middleware/validation');
const logger = require('../utils/logger');

/**
 * Transcription routes
 */

module.exports = (transcriptionController, upload) => {
  /**
   * POST /api/transcribe
   * Upload and transcribe audio file
   */
  router.post(
    '/',
    upload.single('audio'),
    validateFileUpload,
    asyncHandler(async (req, res) => {
      logger.info('Processing audio file transcription', {
        filename: req.file.originalname,
        size: req.file.size
      });

      const result = await transcriptionController.transcribeFile(req.file.path);
      
      res.json({
        success: true,
        text: result
      });
    })
  );

  return router;
};
