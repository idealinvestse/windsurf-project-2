const logger = require('../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const config = require('../config');

/**
 * WebSocket Handler
 * Manages real-time audio streaming and transcription
 */

class WebSocketHandler {
  constructor(io, transcriptionController, taskExecutor, exportService) {
    this.io = io;
    this.transcriptionController = transcriptionController;
    this.taskExecutor = taskExecutor;
    this.exportService = exportService;
    this.activeSessions = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });
      
      this.handleSession(socket);
      this.handleAudioChunks(socket);
      this.handleEndSession(socket);
      this.handleTasks(socket);
      this.handleExport(socket);
      this.handleDisconnect(socket);
    });
  }

  handleSession(socket) {
    socket.on('start_session', (data) => {
      const sessionId = data.sessionId || socket.id;
      socket.join(sessionId);
      
      this.activeSessions.set(sessionId, {
        audioChunks: [],
        isProcessing: false
      });
      
      logger.info('Session started', { sessionId });
    });
  }

  handleAudioChunks(socket) {
    socket.on('audio_chunk', async (data) => {
      const session = this.activeSessions.get(socket.id);
      if (!session) return;

      session.audioChunks.push(Buffer.from(data.chunk, 'base64'));

      // Process in chunks or when buffer is full
      const shouldProcess = 
        session.audioChunks.length >= config.audio.chunkSize ||
        session.audioChunks.length >= config.audio.maxChunkBuffer;

      if (shouldProcess && !session.isProcessing) {
        session.isProcessing = true;

        try {
          await this.processAudioChunks(session, socket.id);
          session.audioChunks = [];
        } catch (error) {
          logger.error('Error processing audio chunk', error);
          socket.emit('error', { message: 'Error processing audio chunk' });
          session.audioChunks = [];
        } finally {
          session.isProcessing = false;
        }
      }
    });
  }

  async processAudioChunks(session, sessionId) {
    const audioBuffer = Buffer.concat(session.audioChunks);
    const tempFilePath = `${config.uploads.directory}temp_${Date.now()}.webm`;
    const outputPath = tempFilePath.replace('.webm', '.mp3');

    fs.writeFileSync(tempFilePath, audioBuffer);

    // Convert to format suitable for Whisper
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .toFormat('mp3')
        .on('end', () => {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          resolve();
        })
        .on('error', (err) => {
          logger.error('Error converting audio', err);
          reject(err);
        })
        .save(outputPath);
    });

    // Transcribe the audio
    await this.transcriptionController.transcribeAndAnalyze(outputPath, sessionId);
  }

  handleEndSession(socket) {
    socket.on('end_session', async () => {
      const session = this.activeSessions.get(socket.id);
      if (!session) return;

      if (session.audioChunks.length > 0) {
        try {
          await this.processAudioChunks(session, socket.id);
        } catch (error) {
          logger.error('Error processing final audio', error);
          socket.emit('error', { message: 'Error processing final audio' });
        }
      }

      // Clean up
      this.activeSessions.delete(socket.id);
      socket.leave(socket.id);
      logger.info('Session ended', { socketId: socket.id });
    });
  }

  handleTasks(socket) {
    socket.on('execute_task', async (data) => {
      const { taskId } = data;

      try {
        const result = await this.taskExecutor.executeTask(taskId);
        socket.emit('task_executed', { taskId, result });
      } catch (error) {
        logger.error('Error executing task', error);
        socket.emit('task_error', { taskId, error: error.message });
      }
    });

    socket.on('reject_task', (data) => {
      const { taskId } = data;
      this.taskExecutor.updateTaskStatus(taskId, 'rejected');
      socket.emit('task_rejected', { taskId });
    });
  }

  handleExport(socket) {
    socket.on('export_transcript', async (data) => {
      const { format, transcript, metadata } = data;

      try {
        let result;

        switch (format) {
          case 'text':
            result = this.exportService.exportToText(transcript, metadata);
            break;
          case 'json':
            result = this.exportService.exportToJSON(transcript, metadata);
            break;
          case 'markdown':
            result = this.exportService.exportToMarkdown(transcript, metadata);
            break;
          case 'srt':
            result = this.exportService.exportToSRT(transcript);
            break;
          case 'vtt':
            result = this.exportService.exportToVTT(transcript);
            break;
          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        socket.emit('export_complete', result);
      } catch (error) {
        logger.error('Error exporting transcript', error);
        socket.emit('export_error', { error: error.message });
      }
    });
  }

  handleDisconnect(socket) {
    socket.on('disconnect', () => {
      this.activeSessions.delete(socket.id);
      logger.info('Client disconnected', { socketId: socket.id });
    });
  }
}

module.exports = WebSocketHandler;
