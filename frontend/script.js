// ===================================================
// VOICE AI - MAIN APPLICATION SCRIPT (DEFENSIVE VERSION)
// ===================================================

console.log('📜 Script.js starting to load...');

const API_BASE_URL = 'http://localhost:8000';
const RECORDING_SAMPLE_RATE = 16000;
const MIN_RECORDING_TIME = 50; // 50ms minimum

// Safely get element with null check
function getEl(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`⚠️ Element #${id} not found`);
    return el;
}

// State variables
let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let timerInterval;
let recordingDuration = 0;
let currentAudioPlayer = null;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded (script loaded after content)
    initializeApp();
}

function initializeApp() {
    console.log('🚀 Initializing Voice AI...');
    setupEventListeners();
    loadSettings();
    checkBackendStatus();
    loadChatHistory();
}

function setupEventListeners() {
    const recordBtn = getEl('recordBtn');
    if (!recordBtn) return console.error('Cannot setup: recordBtn not found');

    // Click to start/stop
    recordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Mouse down to start recording
    recordBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            startRecording();
        }
    });

    // Mouse up to stop recording
    recordBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        }
    });

    // Mouse leave safety
    recordBtn.addEventListener('mouseleave', (e) => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        }
    });

    // Touch support
    recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            startRecording();
        }
    });

    recordBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        }
    });

    // Text input and send
    const sendBtn = getEl('sendBtn');
    const textInput = getEl('textInput');
    
    if (sendBtn) sendBtn.addEventListener('click', sendTextMessage);
    if (textInput) textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            sendTextMessage();
        }
    });

    // Settings
    const darkModeToggle = getEl('darkMode');
    const clearHistoryBtn = getEl('clearHistoryBtn');
    const settingsBtn = getEl('settingsBtn');
    const closeSettingsBtn = getEl('closeSettingsBtn');
    const settingsOverlay = getEl('settingsOverlay');
    const micSensitivity = getEl('micSensitivity');
    const sensitivityValue = getEl('sensitivityValue');

    if (darkModeToggle) darkModeToggle.addEventListener('change', toggleDarkMode);
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearChatHistory);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);
    if (micSensitivity) {
        micSensitivity.addEventListener('input', (e) => {
            if (sensitivityValue) sensitivityValue.textContent = e.target.value + '%';
            localStorage.setItem('micSensitivity', e.target.value);
        });
    }
}

// ===================================================
// RECORDING FUNCTIONS
// ===================================================

async function startRecording() {
    try {
        console.log('🎤 Requesting microphone access...');
        
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: RECORDING_SAMPLE_RATE,
                channelCount: 1
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Microphone access granted');
        
        audioChunks = [];
        
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorder.addEventListener('dataavailable', (event) => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', handleRecordingComplete);
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        
        // Update UI
        const recordBtn = getEl('recordBtn');
        const textInput = getEl('textInput');
        const sendBtn = getEl('sendBtn');
        
        if (recordBtn) {
            recordBtn.classList.add('recording');
            recordBtn.disabled = true;
        }
        if (textInput) textInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        showTimerContainer();
        startTimer();
        console.log('Recording started');

    } catch (error) {
        console.error('Microphone error:', error.name, error.message);
        
        if (error.name === 'NotAllowedError') {
            showError('Microphone permission denied. Please allow access.');
        } else if (error.name === 'NotFoundError') {
            showError('No microphone found. Please connect a microphone.');
        } else {
            showError('Error accessing microphone: ' + error.message);
        }
        
        const recordBtn = getEl('recordBtn');
        if (recordBtn) {
            recordBtn.disabled = false;
            recordBtn.classList.remove('recording');
        }
    }
}

function stopRecording() {
    if (!mediaRecorder) return;
    
    console.log('Stopping recording...');
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    stopTimer();
    hideTimerContainer();
    
    const recordBtn = getEl('recordBtn');
    const textInput = getEl('textInput');
    const sendBtn = getEl('sendBtn');
    
    if (recordBtn) {
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
    }
    if (textInput) textInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
}

async function handleRecordingComplete() {
    try {
        const finalDuration = Date.now() - recordingStartTime;
        console.log('Recording complete:', finalDuration, 'ms');
        
        if (finalDuration < MIN_RECORDING_TIME) {
            showError(`Recording too short (${finalDuration}ms). Please hold longer.`);
            return;
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Audio blob:', audioBlob.size, 'bytes');
        
        if (audioBlob.size === 0) {
            showError('No audio recorded. Please try again.');
            return;
        }
        
        showProcessing();
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        
        const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Response received:', result);
        
        if (result.transcribed_text) {
            addMessage('user', result.transcribed_text);
        }
        
        if (result.response_text) {
            addMessage('bot', result.response_text);
        }
        
        if (result.audio_url) {
            const autoPlay = getEl('autoPlayAudio');
            if (autoPlay && autoPlay.checked) {
                playResponseAudio(result.audio_url);
            }
        }
        
        saveChatHistory();
        
    } catch (error) {
        console.error('Processing error:', error);
        showError('Error processing audio: ' + error.message);
    } finally {
        hideProcessing();
    }
}

// ===================================================
// MESSAGE FUNCTIONS
// ===================================================

function addMessage(sender, content) {
    const chatMessages = getEl('chatMessages');
    if (!chatMessages) return;
    
    const welcomeCard = chatMessages.querySelector('.welcome-card');
    if (welcomeCard) welcomeCard.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-bubble">${escapeHtml(content)}</div>
        <div class="message-time">${timestamp}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    const messagesWrapper = document.querySelector('.messages-wrapper');
    if (messagesWrapper) {
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

async function sendTextMessage() {
    const textInput = getEl('textInput');
    if (!textInput || !textInput.value.trim()) return;
    
    const message = textInput.value.trim();
    textInput.value = '';
    
    addMessage('user', message);
    showProcessing();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) throw new Error('Server error');
        
        const result = await response.json();
        if (result.response) addMessage('bot', result.response);
        if (result.audio_url) {
            const autoPlay = getEl('autoPlayAudio');
            if (autoPlay && autoPlay.checked) playResponseAudio(result.audio_url);
        }
        
        saveChatHistory();
    } catch (error) {
        console.error('Chat error:', error);
        showError('Error: ' + error.message);
    } finally {
        hideProcessing();
    }
}

function playResponseAudio(audioUrl) {
    console.log('Playing:', audioUrl);
    
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    
    const audio = new Audio(audioUrl);
    currentAudioPlayer = audio;
    audio.play().catch(e => console.error('Play error:', e));
}

// ===================================================
// UI FUNCTIONS
// ===================================================

function showError(message) {
    const errorEl = getEl('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    console.error(message);
}

function hideError() {
    const errorEl = getEl('errorMessage');
    if (errorEl) errorEl.style.display = 'none';
}

function showProcessing() {
    const processingEl = getEl('processingMessage');
    if (processingEl) processingEl.style.display = 'flex';
}

function hideProcessing() {
    const processingEl = getEl('processingMessage');
    if (processingEl) processingEl.style.display = 'none';
}

function showTimerContainer() {
    const timerContainer = getEl('timerContainer');
    if (timerContainer) timerContainer.style.display = 'flex';
}

function hideTimerContainer() {
    const timerContainer = getEl('timerContainer');
    if (timerContainer) timerContainer.style.display = 'none';
}

function startTimer() {
    timerInterval = setInterval(() => {
        recordingDuration = Date.now() - recordingStartTime;
        const seconds = Math.floor(recordingDuration / 1000);
        const milliseconds = Math.floor((recordingDuration % 1000) / 10);
        
        const timerDisplay = getEl('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = 
                String(seconds).padStart(2, '0') + ':' + 
                String(milliseconds).padStart(2, '0');
        }
    }, 50);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ===================================================
// SETTINGS
// ===================================================

function openSettings() {
    const modal = getEl('settingsModal');
    const overlay = getEl('settingsOverlay');
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSettings() {
    const modal = getEl('settingsModal');
    const overlay = getEl('settingsOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function toggleDarkMode() {
    const darkModeToggle = getEl('darkMode');
    document.body.classList.toggle('dark-mode');
    if (darkModeToggle) {
        localStorage.setItem('darkMode', darkModeToggle.checked);
    }
}

function loadSettings() {
    const autoPlay = localStorage.getItem('autoPlayAudio') !== 'false';
    const darkMode = localStorage.getItem('darkMode') === 'true';
    const sensitivity = localStorage.getItem('micSensitivity') || '50';
    
    const autoPlayEl = getEl('autoPlayAudio');
    const darkModeEl = getEl('darkMode');
    const micSensEl = getEl('micSensitivity');
    const senValueEl = getEl('sensitivityValue');
    
    if (autoPlayEl) autoPlayEl.checked = autoPlay;
    if (darkModeEl) darkModeEl.checked = darkMode;
    if (micSensEl) micSensEl.value = sensitivity;
    if (senValueEl) senValueEl.textContent = sensitivity + '%';
    
    if (darkMode) document.body.classList.add('dark-mode');
}

function clearChatHistory() {
    if (confirm('Clear all messages?')) {
        const chatMessages = getEl('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="welcome-card">
                    <div class="welcome-icon">🎤</div>
                    <h2>Welcome to Voice AI</h2>
                    <p>Start a conversation</p>
                </div>
            `;
        }
        localStorage.removeItem('chatHistory');
    }
}

// ===================================================
// CHAT HISTORY
// ===================================================

function saveChatHistory() {
    const chatMessages = getEl('chatMessages');
    if (!chatMessages) return;
    
    const messages = [];
    chatMessages.querySelectorAll('.message').forEach(el => {
        const text = el.querySelector('.message-bubble')?.textContent || '';
        const isUser = el.classList.contains('user');
        messages.push({ sender: isUser ? 'user' : 'bot', text });
    });
    
    localStorage.setItem('chatHistory', JSON.stringify(messages));
}

function loadChatHistory() {
    const saved = localStorage.getItem('chatHistory');
    if (!saved) return;
    
    try {
        const messages = JSON.parse(saved);
        messages.forEach(msg => addMessage(msg.sender, msg.text));
    } catch (e) {
        console.error('Error loading history:', e);
    }
}

async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const backendStatus = getEl('backendStatus');
        
        if (response.ok) {
            console.log('Backend online');
            if (backendStatus) {
                backendStatus.textContent = '✅ Online';
                backendStatus.style.color = 'var(--success)';
            }
        } else {
            throw new Error('Not OK');
        }
    } catch (error) {
        console.error('Backend offline');
        const backendStatus = getEl('backendStatus');
        if (backendStatus) {
            backendStatus.textContent = 'Offline';
            backendStatus.style.color = 'var(--error)';
        }
    }
}

console.log('Script loaded');
