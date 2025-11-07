# Whisper Transcription API Wrapper

A comprehensive real-time audio transcription system with AI-powered analysis, automatic task detection, and intelligent tool execution.

## Features

### Core Functionality
- **Real-time Audio Transcription**: Stream audio from your microphone and get instant transcriptions using OpenAI's Whisper API
- **File Upload Support**: Upload pre-recorded audio files for transcription
- **Web-based UI**: Modern, responsive web interface for easy interaction

### AI-Powered Features
- **Intelligent Analysis**: Automatic analysis of transcribed conversations including:
  - Topic and theme identification
  - Sentiment analysis
  - Entity extraction (people, places, organizations)
  - Question detection
  - Summary generation

- **Automatic Task Detection**: AI identifies action items, tasks, and deadlines from conversations
- **Smart Tool Calling**: Contextual tool recommendations and automatic execution with user approval

### Task Management
- **Built-in Tools**:
  - Email sending
  - Calendar event scheduling
  - Reminder setting
  - Note creation
  - Web search
  - Transcript saving

- **Task Queue**: Review and approve AI-suggested tasks before execution
- **Priority Management**: Tasks are categorized by priority (high, medium, low)

### Export Options
Multiple export formats supported:
- Plain Text (.txt)
- JSON (.json)
- Markdown (.md)
- SRT Subtitles (.srt)
- WebVTT (.vtt)

## Architecture

```
whisper-transcriber/
├── server.js                 # Main Express server with WebSocket support
├── services/
│   ├── aiAnalyzer.js        # AI analysis using GPT-4
│   ├── taskExecutor.js      # Task and tool execution engine
│   └── exportService.js     # Multi-format export functionality
├── public/
│   ├── index.html           # Main web interface
│   ├── styles.css           # UI styling
│   └── app.js               # Client-side logic
├── uploads/                 # Temporary audio file storage
├── exports/                 # Generated export files
├── notes/                   # Created notes
└── transcripts/             # Saved transcripts
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key
- FFmpeg (required for audio processing)

### Installing FFmpeg

**Windows:**
1. Download from [FFmpeg website](https://ffmpeg.org/download.html)
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add to PATH or the package will use the bundled version

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### Setup

1. Clone or download this project

2. Navigate to the project directory:
```bash
cd whisper-transcriber
```

3. Install dependencies:
```bash
npm install
```

4. Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NODE_ENV=development
```

5. Start the server:
```bash
node server.js
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Real-time Recording

1. Click **Start Recording**
2. Allow microphone access when prompted
3. Speak into your microphone
4. Click **Stop Recording** when finished
5. View the transcription, AI analysis, and detected tasks

### File Upload

1. Click **Upload Audio File**
2. Select an audio file (supported formats: mp3, wav, m4a, webm, etc.)
3. Wait for processing
4. View results

### Task Management

- **Execute**: Approve and run the suggested task
- **Reject**: Decline the task suggestion
- Tasks are color-coded by priority:
  - Red: High priority
  - Orange: Medium priority
  - Green: Low priority

### Exporting Transcripts

1. Select desired format from the dropdown
2. Click **Export Transcript**
3. Files are saved to the `exports/` directory
4. Download link appears on success

## API Endpoints

### Transcription
```
POST /api/transcribe
Body: FormData with 'audio' file
Response: { success: true, text: "transcription" }
```

### Analysis
```
POST /api/analyze
Body: { text: "text to analyze", sessionId: "optional" }
Response: { success: true, analysis: {...} }
```

### Tasks
```
GET /api/tasks
Response: { success: true, tasks: [...] }

GET /api/tasks/:taskId
Response: { success: true, task: {...} }

POST /api/tasks/:taskId/execute
Response: { success: true, result: {...} }

DELETE /api/tasks/:taskId
Response: { success: true, message: "Task deleted" }
```

### Tools
```
GET /api/tools
Response: { success: true, tools: [...] }

POST /api/tools/:toolName/execute
Body: { parameters: {...} }
Response: { success: true, result: {...} }
```

### Export
```
POST /api/export
Body: { format: "text|json|markdown|srt|vtt", transcript: [...], metadata: {...} }
Response: { success: true, filepath: "...", filename: "..." }

GET /api/exports
Response: { success: true, exports: [...] }

GET /api/exports/:filename
Response: File download

DELETE /api/exports/:filename
Response: { success: true, message: "File deleted" }
```

## WebSocket Events

### Client → Server
- `start_session`: Initialize a new transcription session
- `audio_chunk`: Send audio data for processing
- `end_session`: End the current session
- `execute_task`: Execute a specific task
- `reject_task`: Reject a task suggestion
- `export_transcript`: Export transcript in specified format

### Server → Client
- `transcription`: Transcription result
- `analysis`: AI analysis results
- `action_item`: Detected action item
- `task_created`: New task created
- `task_executed`: Task execution result
- `task_error`: Task execution error
- `export_complete`: Export completed
- `export_error`: Export error
- `error`: General error

## Customization

### Adding Custom Tools

Edit `services/taskExecutor.js`:

```javascript
this.registerTool('myCustomTool', {
  description: 'Description of what the tool does',
  execute: async (params) => {
    // Your implementation here
    return {
      success: true,
      message: 'Tool executed successfully'
    };
  },
  parameters: {
    param1: 'string',
    param2: 'number'
  }
});
```

### Customizing AI Analysis

Edit `services/aiAnalyzer.js` to modify the system prompts and analysis parameters.

### Styling

Edit `public/styles.css` to customize the appearance of the web interface.

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Audio Processing

Audio is automatically converted to MP3 format for Whisper API compatibility. Chunk size and processing intervals can be adjusted in `server.js`.

## Troubleshooting

### Microphone Not Working
- Ensure HTTPS is used (or localhost for development)
- Check browser permissions for microphone access
- Verify microphone is not being used by another application

### FFmpeg Errors
- Ensure FFmpeg is installed and accessible
- The app includes `ffmpeg-static` as a fallback

### API Errors
- Verify your OpenAI API key is correct
- Check API usage limits and billing status
- Review server console for detailed error messages

### Export Issues
- Ensure the `exports/` directory is writable
- Check available disk space

## Performance Tips

1. **For long recordings**: The app processes audio in chunks to prevent memory issues
2. **API costs**: Be mindful of OpenAI API usage (Whisper + GPT-4)
3. **Storage**: Old exports and uploads should be cleaned periodically

## Security Considerations

1. **API Keys**: Never commit `.env` files to version control
2. **File uploads**: Implement file size limits in production
3. **Authentication**: Add user authentication for production deployments
4. **HTTPS**: Use HTTPS in production environments
5. **Rate limiting**: Implement rate limiting to prevent abuse

## Future Enhancements

- [ ] User authentication and session management
- [ ] Multi-language support
- [ ] Speaker diarization
- [ ] Real-time collaboration
- [ ] Cloud storage integration
- [ ] Advanced task automation workflows
- [ ] Custom AI model fine-tuning
- [ ] Mobile app support

## License

MIT License - feel free to use and modify as needed.

## Support

For issues or questions, please create an issue in the project repository.

## Credits

Built with:
- OpenAI Whisper API
- GPT-4 for analysis
- Express.js
- Socket.io
- FFmpeg
