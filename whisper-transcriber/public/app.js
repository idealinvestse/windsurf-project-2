document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    const audioFileInput = document.getElementById('audioFile');
    const statusEl = document.getElementById('status');
    const recordingTimeEl = document.getElementById('recordingTime');
    const transcriptEl = document.getElementById('transcript');
    const analysisEl = document.getElementById('analysis');
    const tasksEl = document.getElementById('tasks');
    const exportBtn = document.getElementById('exportBtn');
    const exportFormat = document.getElementById('exportFormat');
    const exportStatus = document.getElementById('exportStatus');
    
    // Audio recording variables
    let mediaRecorder;
    let audioChunks = [];
    let recordingInterval;
    let seconds = 0;
    
    // Store transcript data
    let transcriptData = [];
    let tasks = {};
    
    // Socket.io connection
    const socket = io();
    
    // Initialize socket connection
    socket.on('connect', () => {
        console.log('Connected to server');
        // Start a new session when connected
        socket.emit('start_session', { sessionId: socket.id });
    });
    
    // Handle transcription results
    socket.on('transcription', (data) => {
        const { text, isFinal } = data;
        
        // Store transcript data
        transcriptData.push({ text, timestamp: new Date().toISOString() });
        
        // Add the transcription to the UI
        const p = document.createElement('p');
        p.textContent = text;
        transcriptEl.appendChild(p);
        
        // Auto-scroll to the latest transcription
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error('Error:', error);
        statusEl.textContent = `Error: ${error.message || 'An error occurred'}`;
        statusEl.style.color = 'red';
        
        // Reset status after 3 seconds
        setTimeout(() => {
            statusEl.textContent = 'Ready to record';
            statusEl.style.color = '';
        }, 3000);
    });
    
    // Handle AI analysis results
    socket.on('analysis', (data) => {
        console.log('Analysis received:', data);
        displayAnalysis(data);
    });
    
    // Handle action items
    socket.on('action_item', (data) => {
        console.log('Action item received:', data);
        addTask(data);
    });
    
    // Handle task creation
    socket.on('task_created', (data) => {
        console.log('Task created:', data);
        addTask(data);
    });
    
    // Handle task execution results
    socket.on('task_executed', (data) => {
        console.log('Task executed:', data);
        updateTaskStatus(data.taskId, 'completed');
    });
    
    // Handle task errors
    socket.on('task_error', (data) => {
        console.log('Task error:', data);
        updateTaskStatus(data.taskId, 'failed');
    });
    
    // Handle export completion
    socket.on('export_complete', (data) => {
        console.log('Export complete:', data);
        showExportStatus(`Successfully exported to ${data.filename}`, 'success');
    });
    
    // Handle export errors
    socket.on('export_error', (data) => {
        console.log('Export error:', data);
        showExportStatus(`Error: ${data.error}`, 'error');
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        statusEl.textContent = 'Disconnected from server';
    });
    
    // Start recording
    startBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    // Convert blob to base64 and send to server
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64data = reader.result.split(',')[1];
                        socket.emit('audio_chunk', { 
                            chunk: base64data,
                            sessionId: socket.id
                        });
                    };
                    reader.readAsDataURL(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                // Send end of session
                socket.emit('end_session', { sessionId: socket.id });
                clearInterval(recordingInterval);
                recordingTimeEl.textContent = '00:00';
                statusEl.textContent = 'Recording stopped';
                statusEl.classList.remove('recording');
                startBtn.disabled = false;
                stopBtn.disabled = true;
            };
            
            // Start recording
            mediaRecorder.start(1000); // Collect data every second
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Start timer
            seconds = 0;
            updateTimer();
            recordingInterval = setInterval(updateTimer, 1000);
            
            statusEl.textContent = 'Recording...';
            statusEl.classList.add('recording');
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            statusEl.textContent = 'Error accessing microphone';
            statusEl.style.color = 'red';
        }
    });
    
    // Stop recording
    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Clear any pending audio chunks
            audioChunks = [];
        }
    });
    
    // Clear transcript and analysis
    clearBtn.addEventListener('click', () => {
        transcriptEl.innerHTML = '';
        analysisEl.innerHTML = '';
        tasksEl.innerHTML = '';
        transcriptData = [];
        tasks = {};
        statusEl.textContent = 'Ready to record';
        statusEl.style.color = '';
    });
    
    // Export button handler
    exportBtn.addEventListener('click', () => {
        if (transcriptData.length === 0) {
            showExportStatus('No transcript to export', 'error');
            return;
        }
        
        const format = exportFormat.value;
        const metadata = {
            includeMetadata: true,
            duration: seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : undefined
        };
        
        socket.emit('export_transcript', {
            format,
            transcript: transcriptData,
            metadata
        });
        
        showExportStatus('Exporting...', '');
    });
    
    // Handle file upload
    audioFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('audio', file);
        
        statusEl.textContent = 'Processing audio file...';
        
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Error transcribing audio');
            }
            
            const data = await response.json();
            
            // Add the transcription to the UI
            const p = document.createElement('p');
            p.textContent = data.text;
            transcriptEl.appendChild(p);
            transcriptEl.scrollTop = transcriptEl.scrollHeight;
            
            // Analyze the transcription
            analyzeText(data.text);
            
            statusEl.textContent = 'Transcription complete';
            
        } catch (error) {
            console.error('Error:', error);
            statusEl.textContent = 'Error processing audio file';
            statusEl.style.color = 