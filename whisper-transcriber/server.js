require('dotenv').config();
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
const AIAnalyzer = require('./services/aiAnalyzer');
const TaskExecutor = require('./services/taskExecutor');
const ExportService = require('./services/exportService');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Initialize services
const aiAnalyzer = new AIAnalyzer(process.env.OPENAI_API_KEY);
const taskExecutor = new TaskExecutor();
const exportService = new ExportService();

// Store active transcriptions
const activeSessions = new Map();

// Transcribe audio using Whisper API
async function transcribeAudio(audioPath, sessionId) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });
    
    io.to(sessionId).emit('transcription', {
      text: transcription.text,
      isFinal: true
    });
    
    // Perform AI analysis in parallel
    try {
      const analysis = await aiAnalyzer.analyzeTranscript(transcription.text, sessionId);
      io.to(sessionId).emit('analysis', analysis);
      
      // Check if any tools should be called
      const availableTools = taskExecutor.getAvailableTools();
      const toolDecision = await aiAnalyzer.shouldCallTool(transcription.text, availableTools);
      
      if (toolDecision.shouldCall && toolDecision.tools && toolDecision.tools.length > 0) {
        for (const tool of toolDecision.tools) {
          // Add task to queue
          const taskId = taskExecutor.addTask({
            toolName: tool.name,
            parameters: tool.parameters,
            description: tool.reason,
            autoExecute: false // Require user approval by default
          });
          
          io.to(sessionId).emit('task_created', {
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
          const taskId = taskExecutor.addTask({
            description: actionItem.task,
            priority: actionItem.priority,
            deadline: actionItem.deadline,
            autoExecute: false
          });
          
          io.to(sessionId).emit('action_item', {
            taskId,
            ...actionItem
          });
        }
      }
    } catch (analysisError) {
      console.error('Error in AI analysis:', analysisError);
      // Don't fail the transcription if analysis fails
    }
    
    // Clean up the temporary file
    fs.unlinkSync(audioPath);
    
    return transcription.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    io.to(sessionId).emit('error', { message: 'Error transcribing audio' });
    throw error;
  }
}

// WebSocket connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Handle new session
  socket.on('start_session', (data) => {
    const sessionId = data.sessionId || socket.id;
    socket.join(sessionId);
    activeSessions.set(sessionId, {
      audioChunks: [],
      isProcessing: false
    });
    console.log(`Session started: ${sessionId}`);
  });
  
  // Handle audio chunks
  socket.on('audio_chunk', async (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;
    
    session.audioChunks.push(Buffer.from(data.chunk, 'base64'));
    
    // Process in chunks (e.g., every 3 seconds of audio)
    if (session.audioChunks.length >= 3 && !session.isProcessing) {
      session.isProcessing = true;
      
      try {
        const audioBuffer = Buffer.concat(session.audioChunks);
        const tempFilePath = `uploads/temp_${Date.now()}.webm`;
        
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // Convert to format suitable for Whisper
        const outputPath = tempFilePath.replace('.webm', '.mp3');
        
        await new Promise((resolve, reject) => {
          ffmpeg(tempFilePath)
            .toFormat('mp3')
            .on('end', () => {
              fs.unlinkSync(tempFilePath);
              resolve();
            })
            .on('error', (err) => {
              console.error('Error converting audio:', err);
              reject(err);
            })
            .save(outputPath);
        });
        
        // Transcribe the audio
        await transcribeAudio(outputPath, socket.id);
        
        // Clear processed chunks
        session.audioChunks = [];
      } catch (error) {
        console.error('Error processing audio chunk:', error);
        socket.emit('error', { message: 'Error processing audio chunk' });
      } finally {
        session.isProcessing = false;
      }
    }
  });
  
  // Handle end of session
  socket.on('end_session', async () => {
    const session = activeSessions.get(socket.id);
    if (!session) return;
    
    if (session.audioChunks.length > 0) {
      try {
        const audioBuffer = Buffer.concat(session.audioChunks);
        const tempFilePath = `uploads/final_${Date.now()}.webm`;
        
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // Convert to format suitable for Whisper
        const outputPath = tempFilePath.replace('.webm', '.mp3');
        
        await new Promise((resolve, reject) => {
          ffmpeg(tempFilePath)
            .toFormat('mp3')
            .on('end', () => {
              fs.unlinkSync(tempFilePath);
              resolve();
            })
            .on('error', reject)
            .save(outputPath);
        });
        
        // Transcribe the final audio
        await transcribeAudio(outputPath, socket.id);
      } catch (error) {
        console.error('Error processing final audio:', error);
        socket.emit('error', { message: 'Error processing final audio' });
      }
    }
    
    // Clean up
    activeSessions.delete(socket.id);
    socket.leave(socket.id);
    console.log(`Session ended: ${socket.id}`);
  });
  
  // Handle task approval/execution
  socket.on('execute_task', async (data) => {
    const { taskId } = data;
    
    try {
      const result = await taskExecutor.executeTask(taskId);
      socket.emit('task_executed', {
        taskId,
        result
      });
    } catch (error) {
      console.error('Error executing task:', error);
      socket.emit('task_error', {
        taskId,
        error: error.message
      });
    }
  });
  
  // Handle task rejection
  socket.on('reject_task', (data) => {
    const { taskId } = data;
    taskExecutor.updateTaskStatus(taskId, 'rejected');
    socket.emit('task_rejected', { taskId });
  });
  
  // Handle export request
  socket.on('export_transcript', async (data) => {
    const { format, transcript, metadata } = data;
    
    try {
      let result;
      
      switch (format) {
        case 'text':
          result = exportService.exportToText(transcript, metadata);
          break;
        case 'json':
          result = exportService.exportToJSON(transcript, metadata);
          break;
        case 'markdown':
          result = exportService.exportToMarkdown(transcript, metadata);
          break;
        case 'srt':
          result = exportService.exportToSRT(transcript);
          break;
        case 'vtt':
          result = exportService.exportToVTT(transcript);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      socket.emit('export_complete', result);
    } catch (error) {
      console.error('Error exporting transcript:', error);
      socket.emit('export_error', {
        error: error.message
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    activeSessions.delete(socket.id);
    aiAnalyzer.clearHistory(socket.id);
    console.log('Client disconnected');
  });
});

// File upload endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const transcription = await transcribeAudio(req.file.path, 'file-upload');
    
    res.json({
      success: true,
      text: transcription
    });
  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ error: 'Error processing audio file' });
  }
});

// AI Analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, sessionId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    const analysis = await aiAnalyzer.analyzeTranscript(text, sessionId || 'api-request');
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Error in analysis:', error);
    res.status(500).json({ error: 'Error analyzing text' });
  }
});

// Task management endpoints
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = taskExecutor.getAllTasks();
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

app.get('/api/tasks/:taskId', (req, res) => {
  try {
    const task = taskExecutor.getTask(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Error fetching task' });
  }
});

app.post('/api/tasks/:taskId/execute', async (req, res) => {
  try {
    const result = await taskExecutor.executeTask(req.params.taskId);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:taskId', (req, res) => {
  try {
    taskExecutor.deleteTask(req.params.taskId);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Error deleting task' });
  }
});

// Tools endpoints
app.get('/api/tools', (req, res) => {
  try {
    const tools = taskExecutor.getAvailableTools();
    res.json({ success: true, tools });
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Error fetching tools' });
  }
});

app.post('/api/tools/:toolName/execute', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { parameters } = req.body;
    
    const result = await taskExecutor.executeTool(toolName, parameters);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export endpoints
app.get('/api/exports', (req, res) => {
  try {
    const exports = exportService.listExports();
    res.json({ success: true, exports });
  } catch (error) {
    console.error('Error fetching exports:', error);
    res.status(500).json({ error: 'Error fetching exports' });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const { format, transcript, metadata } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }
    
    let result;
    
    switch (format) {
      case 'text':
        result = exportService.exportToText(transcript, metadata);
        break;
      case 'json':
        result = exportService.exportToJSON(transcript, metadata);
        break;
      case 'markdown':
        result = exportService.exportToMarkdown(transcript, metadata);
        break;
      case 'srt':
        result = exportService.exportToSRT(transcript);
        break;
      case 'vtt':
        result = exportService.exportToVTT(transcript);
        break;
      case 'complete':
        result = exportService.exportComplete(req.body);
        break;
      default:
        return res.status(400).json({ error: `Unsupported format: ${format}` });
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({ error: 'Error exporting transcript' });
  }
});

app.get('/api/exports/:filename', (req, res) => {
  try {
    const filepath = path.join(exportService.outputDir, req.params.filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filepath);
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({ error: 'Error downloading file' });
  }
});

app.delete('/api/exports/:filename', (req, res) => {
  try {
    const result = exportService.deleteExport(req.params.filename);
    
    if (!result.success) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Error deleting export:', error);
    res.status(500).json({ error: 'Error deleting file' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available tools: ${taskExecutor.getAvailableTools().length}`);
});
