# Whisper Transcription API with Web UI

A real-time speech-to-text application using OpenAI's Whisper model, featuring a web interface with microphone recording, real-time transcription, and sidechain analysis.

## Features

- Real-time audio streaming with WebSocket
- Microphone recording in the browser
- Whisper model for accurate speech recognition
- Sidechain analysis for dialog processing
- Task execution system for automated workflows
- Modern React-based web interface

## Prerequisites

- Python 3.8+
- Node.js 16+
- FFmpeg (for audio processing)

## Setup

1. Clone the repository
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Create a `.env` file in the root directory with your configuration:
   ```
   WHISPER_MODEL=base  # or tiny, small, medium, large
   ```

## Running the Application

1. Start the FastAPI backend:
   ```bash
   uvicorn app.main:app --reload
   ```

2. In a separate terminal, start the React frontend:
   ```bash
   cd frontend
   npm start
   ```

3. Open your browser to `http://localhost:3000`

## API Endpoints

- `GET /health` - Health check endpoint
- `WS /ws/transcribe` - WebSocket endpoint for real-time audio streaming

## Project Structure

- `/app` - Backend Python code
- `/frontend` - React frontend application
- `/models` - Custom models and utilities
- `/tasks` - Task execution system

## License

MIT
