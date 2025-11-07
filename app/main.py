from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import whisper
import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Whisper Transcription API",
              description="Real-time speech-to-text with Whisper and sidechain analysis",
              version="0.1.0")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model
MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
model = whisper.load_model(MODEL_SIZE)

# Store active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

# WebSocket endpoint for real-time audio streaming
@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive audio data from client
            data = await websocket.receive_bytes()
            
            # Process audio with Whisper (this is a simplified example)
            # In a real implementation, you would buffer and process chunks
            result = model.transcribe("temp_audio.wav")
            
            # Send transcription back to client
            await manager.send_message(
                json.dumps({"text": result["text"]}),
                websocket
            )
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": MODEL_SIZE}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
