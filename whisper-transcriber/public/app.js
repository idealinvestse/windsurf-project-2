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
            
            // Store transcript data
            transcriptData.push({ text: data.text, timestamp: new Date().toISOString() });
            
            // Add the transcription to the UI
            const p = document.createElement('p');
            p.textContent = data.text;
            transcriptEl.appendChild(p);
            transcriptEl.scrollTop = transcriptEl.scrollHeight;
            
            statusEl.textContent = 'Transcription complete';
            
        } catch (error) {
            console.error('Error:', error);
            statusEl.textContent = 'Error processing audio file';
            statusEl.style.color = 'red';
        } finally {
            // Reset the file input
            event.target.value = '';
        }
    });
    
    // Update the recording timer
    function updateTimer() {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        recordingTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    
    // Display AI analysis
    function displayAnalysis(data) {
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'analysis-result';
        
        let html = '<strong>Summary:</strong><br>' + (data.summary || 'No summary available') + '<br><br>';
        
        if (data.topics && data.topics.length > 0) {
            html += '<strong>Topics:</strong><br>' + data.topics.join(', ') + '<br><br>';
        }
        
        if (data.entities) {
            const entities = [];
            if (data.entities.people && data.entities.people.length > 0) {
                entities.push('People: ' + data.entities.people.join(', '));
            }
            if (data.entities.places && data.entities.places.length > 0) {
                entities.push('Places: ' + data.entities.places.join(', '));
            }
            if (entities.length > 0) {
                html += '<strong>Entities:</strong><br>' + entities.join('<br>') + '<br><br>';
            }
        }
        
        if (data.questions && data.questions.length > 0) {
            html += '<strong>Questions:</strong><br>- ' + data.questions.join('<br>- ') + '<br><br>';
        }
        
        if (data.sentiment) {
            html += '<strong>Sentiment:</strong> ' + data.sentiment + '<br>';
        }
        
        analysisDiv.innerHTML = html;
        analysisEl.appendChild(analysisDiv);
        analysisEl.scrollTop = analysisEl.scrollHeight;
    }
    
    // Add task to UI
    function addTask(taskData) {
        const taskId = taskData.taskId;
        tasks[taskId] = taskData;
        
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item priority-${(taskData.priority || 'medium').toLowerCase()}`;
        taskDiv.id = `task-${taskId}`;
        
        const priorityClass = (taskData.priority || 'medium').toLowerCase();
        
        let html = `
            <div class="task-header">
                <span class="task-title">${taskData.task || taskData.description || taskData.toolName || 'Task'}</span>
                <span class="task-priority ${priorityClass}">${taskData.priority || 'medium'}</span>
            </div>
        `;
        
        if (taskData.reason) {
            html += `<div class="task-description">${taskData.reason}</div>`;
        }
        
        if (taskData.deadline) {
            html += `<div class="task-description"><strong>Deadline:</strong> ${taskData.deadline}</div>`;
        }
        
        html += `
            <div class="task-actions">
                <button class="btn btn-success" onclick="executeTask('${taskId}')">Execute</button>
                <button class="btn btn-danger" onclick="rejectTask('${taskId}')">Reject</button>
            </div>
        `;
        
        taskDiv.innerHTML = html;
        tasksEl.appendChild(taskDiv);
        tasksEl.scrollTop = tasksEl.scrollHeight;
    }
    
    // Execute task
    window.executeTask = function(taskId) {
        socket.emit('execute_task', { taskId });
        updateTaskStatus(taskId, 'executing');
    };
    
    // Reject task
    window.rejectTask = function(taskId) {
        socket.emit('reject_task', { taskId });
        updateTaskStatus(taskId, 'rejected');
    };
    
    // Update task status
    function updateTaskStatus(taskId, status) {
        const taskEl = document.getElementById(`task-${taskId}`);
        if (taskEl) {
            taskEl.classList.add(`status-${status}`);
            const actionsDiv = taskEl.querySelector('.task-actions');
            if (actionsDiv) {
                if (status === 'completed') {
                    actionsDiv.innerHTML = '<span style="color: #27ae60;">✓ Completed</span>';
                } else if (status === 'rejected') {
                    actionsDiv.innerHTML = '<span style="color: #e74c3c;">✗ Rejected</span>';
                } else if (status === 'executing') {
                    actionsDiv.innerHTML = '<span>Executing...</span>';
                } else if (status === 'failed') {
                    actionsDiv.innerHTML = '<span style="color: #e74c3c;">✗ Failed</span>';
                }
            }
        }
    }
    
    // Show export status
    function showExportStatus(message, type) {
        exportStatus.textContent = message;
        exportStatus.className = 'export-status';
        if (type) {
            exportStatus.classList.add(type);
        }
        
        // Clear status after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                exportStatus.textContent = '';
                exportStatus.className = 'export-status';
            }, 5000);
        }
    }
    
    // Update the recording timer
    function updateTimer() {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        recordingTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
});
