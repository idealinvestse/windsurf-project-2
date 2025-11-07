const fs = require('fs');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * Transcription Controller
 * Handles transcription business logic
 */

class TranscriptionController {
  constructor(openai, aiAnalyzer, taskExecutor, io) {
    this.openai = openai;
    this.aiAnalyzer = aiAnalyzer;
    this.taskExecutor = taskExecutor;
    this.io = io;
  }

  /**
   * Transcribe audio file
   */
  async transcribeFile(audioPath) {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
      });

      logger.info('Audio transcribed successfully', {
        length: transcription.text.length
      });

      // Clean up the file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      return transcription.text;
    } catch (error) {
      logger.error('Error transcribing audio', error);
      
      // Clean up file on error
      if (fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
        } catch (cleanupError) {
          logger.error('Error cleaning up file', cleanupError);
        }
      }
      
      throw new AppError('Failed to transcribe audio', 500);
    }
  }

  /**
   * Transcribe and analyze audio
   */
  async transcribeAndAnalyze(audioPath, sessionId) {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
      });

      // Emit transcription
      this.io.to(sessionId).emit('transcription', {
        text: transcription.text,
        isFinal: true
      });

      // Perform AI analysis in parallel
      try {
        const analysis = await this.aiAnalyzer.analyzeTranscript(
          transcription.text,
          sessionId
        );
        this.io.to(sessionId).emit('analysis', analysis);

        // Check if any tools should be called
        const availableTools = this.taskExecutor.getAvailableTools();
        const toolDecision = await this.aiAnalyzer.shouldCallTool(
          transcription.text,
          availableTools
        );

        if (toolDecision.shouldCall && toolDecision.tools && toolDecision.tools.length > 0) {
          for (const tool of toolDecision.tools) {
            const taskId = this.taskExecutor.addTask({
              toolName: tool.name,
              parameters: tool.parameters,
              description: tool.reason,
              autoExecute: false
            });

            this.io.to(sessionId).emit('task_created', {
              taskId,
              toolName: tool.name,
              reason: tool.reason,
              requiresApproval: true
            });
          }
        }

        // Extract and create tasks
        if (analysis.actionItems && analysis.actionItems.length > 0) {
          for (const actionItem of analysis.actionItems) {
            const taskId = this.taskExecutor.addTask({
              description: actionItem.task,
              priority: actionItem.priority,
              deadline: actionItem.deadline,
              autoExecute: false
            });

            this.io.to(sessionId).emit('action_item', {
              taskId,
              ...actionItem
            });
          }
        }
      } catch (analysisError) {
        logger.error('Error in AI analysis', analysisError);
        // Don't fail the transcription if analysis fails
      }

      // Clean up the file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      return transcription.text;
    } catch (error) {
      logger.error('Error transcribing audio', error);
      this.io.to(sessionId).emit('error', { message: 'Error transcribing audio' });
      throw error;
    }
  }
}

module.exports = TranscriptionController;
