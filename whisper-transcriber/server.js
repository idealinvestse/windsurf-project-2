const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Import configuration and utilities
const config = require('./config');
const logger = require('./utils/logger');

// Import services
const AIAnalyzer = require('./services/aiAnalyzer');
const TaskExecutor = require('./services/taskExecutor');
const ExportService = require('./services/exportService');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import controllers
const TranscriptionController = require('./controllers/transcriptionController');

// Import routes
const transcriptionRoutes = require('./routes/transcription');

// Import WebSocket handler
const WebSocketHandler = require('./websocket/handler');

/**
 * Initialize Express application
 */
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.server.corsOrigin,
    methods: ["GET", "POST"]
  }
});

/**
 * Configure middleware
 */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(requestLogger);

/**
 * Configure file upload
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploads.directory)) {
      fs.mkdirSync(config.uploads.directory, { recursive: true });
    }
    cb(null, config.uploads.directory);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxSize }
});

/**
 * Set ffmpeg path
 */
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Initialize services
 */
logger.info('Initializing services...');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const aiAnalyzer = new AIAnalyzer(config.openai.apiKey);
const taskExecutor = new TaskExecutor();
const exportService = new ExportService();

logger.info('Services initialized successfully');

/**
 * Initialize controllers
 */
const transcriptionController = new TranscriptionController(
  openai,
  aiAnalyzer,
  taskExecutor,
  io
);

/**
 * Setup WebSocket
 */
new WebSocketHandler(io, transcriptionController, taskExecutor, exportService);

/**
 * Setup routes
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Whisper Transcription API',
    version: '1.0.0',
    status: 'operational'
  });
});

app.use('/api/transcribe', transcriptionRoutes(transcriptionController, upload));

// Additional routes would go here (tasks, exports, etc.)

/**
 * Error handling
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

/**
 * Start server
 */
server.listen(config.server.port, () => {
  logger.info(`Server running on port ${config.server.port}`, {
    environment: config.server.env,
    tools: taskExecutor.getAvailableTools().length
  });
});
