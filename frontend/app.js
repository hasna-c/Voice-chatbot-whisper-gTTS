// ===================================================
// VOICE AI - MAIN APPLICATION SCRIPT (CLEAN VERSION)
// ===================================================

console.log('App.js loading - timestamp:', new Date().toISOString());

const API_BASE_URL = 'http://localhost:8000';
const RECORDING_SAMPLE_RATE = 16000;
const MIN_RECORDING_TIME = 200; // 200ms minimum

let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let timerInterval;
let recordingDuration = 0;
let currentAudioPlayer = null;
let isRecording = false; // Explicit tracking flag

// Safe element getter
function getEl(id) {
    return document.getElementById(id);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('Initializing app...');
    setupRecordBtn();
    setupSendBtn();
    setupSettings();
    loadSettings();
    checkBackend();
    loadHistory();
}

// ===================================================
// RECORD BUTTON
// ===================================================

function setupRecordBtn() {
    const btn = getEl('recordBtn');
    if (!btn) {
        console.error('recordBtn not found');
        return;
    }
    
    // Simple click toggle: click to start, click to stop
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (isRecording) {
            console.log('User clicked - stopping record');
            stopRecording();
        } else {
            console.log('User clicked - starting record');
            startRecording();
        }
    });
}

async function startRecording() {
    try {
        console.log('Recording start requested');
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: RECORDING_SAMPLE_RATE,
                channelCount: 1
            }
        });
        
        console.log('Microphone granted');
        audioChunks = [];
        
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.addEventListener('dataavailable', (e) => {
            audioChunks.push(e.data);
        });
        mediaRecorder.addEventListener('stop', onRecordingStop);
        
        mediaRecorder.start();
        recordingStartTime = Date.now();
        isRecording = true;
        console.log('mediaRecorder.start() called');
        
        // UI update - safe
        const btn = getEl('recordBtn');
        const input = getEl('textInput');
        const send = getEl('sendBtn');
        
        if (btn) {
            btn.classList.add('recording');
            // DO NOT disable - user needs to click to stop
        }
        if (input) input.disabled = true;
        if (send) send.disabled = true;
        
        showTimer();
        startTimer();
        
        // Wait briefly for mediaRecorder state to fully transition
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('Recording started, state:', mediaRecorder.state);
        
    } catch (error) {
        console.error('Mic error:', error.message);
        showError('Microphone error: ' + error.message);
        
        const btn = getEl('recordBtn');
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('recording');
        }
    }
}

function stopRecording() {
    if (!mediaRecorder) {
        console.log('No mediaRecorder');
        isRecording = false;
        return;
    }
    
    console.log('Stopping mediaRecorder, current state:', mediaRecorder.state);
    isRecording = false;
    
    try {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        console.log('mediaRecorder.stop() and tracks stopped');
    } catch (e) {
        console.error('Stop error:', e.message);
    }
    
    stopTimer();
    hideTimer();
    
    const btn = getEl('recordBtn');
    const input = getEl('textInput');
    const send = getEl('sendBtn');
    
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('recording');
        console.log('Button state reset');
    }
    if (input) input.disabled = false;
    if (send) send.disabled = false;
    
    console.log('Stop complete, isRecording:', isRecording);
}

async function onRecordingStop() {
    try {
        // Safety: ensure flag is reset
        isRecording = false;
        console.log('onRecordingStop fired, isRecording reset to false');
        
        const duration = Date.now() - recordingStartTime;
        console.log('Recording stopped, duration:', duration + 'ms');
        
        if (duration < MIN_RECORDING_TIME) {
            console.log('Too short ('+duration+'ms), need '+MIN_RECORDING_TIME+'ms');
            showError(`Too short (${duration}ms), need ${MIN_RECORDING_TIME}ms`);
            return;
        }
        
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        if (blob.size === 0) {
            showError('No audio captured');
            return;
        }
        
        console.log('Blob size:', blob.size);
        showProcessing();
        
        const fd = new FormData();
        fd.append('file', blob, 'rec.webm');
        fd.append('language', 'en');  // English only
        
        console.log('[FORM DATA] Sending English audio to /api/process');
        
        const res = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            body: fd
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        console.log('Response:', data);
        
        if (data.transcribed_text) addMsg('user', data.transcribed_text);
        if (data.response_text) {
            // Audio URL needs to be full backend URL
            const audioUrl = data.audio_url ? `${API_BASE_URL}${data.audio_url}` : null;
            addMsg('bot', data.response_text, audioUrl);
        }
        if (data.audio_url) {
            console.log('🎵 Audio URL received:', data.audio_url);
            const fullAudioUrl = `${API_BASE_URL}${data.audio_url}`;
            // Auto-play if enabled
            const autoPlay = getEl('autoPlayAudio');
            if (autoPlay && autoPlay.checked) {
                playAudio(fullAudioUrl);
            }
        }
        
        saveHistory();
    } catch (err) {
        console.error('Process error:', err);
        showError('Error: ' + err.message);
    } finally {
        hideProcessing();
    }
}

// ===================================================
// SEND BUTTON
// ===================================================

function setupSendBtn() {
    const btn = getEl('sendBtn');
    const inp = getEl('textInput');
    
    if (btn) btn.addEventListener('click', sendMsg);
    if (inp) inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMsg();
    });
}

async function sendMsg() {
    const inp = getEl('textInput');
    if (!inp || !inp.value.trim()) return;
    
    const text = inp.value.trim();
    inp.value = '';
    
    addMsg('user', text);
    showProcessing();
    
    try {
        console.log('[TEXT INPUT] Message:', text);
        
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, language: 'en' })  // English only
        });
        
        const data = await res.json();
        if (data.response) addMsg('bot', data.response, data.audio_url ? `${API_BASE_URL}${data.audio_url}` : null);
        if (data.audio_url) {
            console.log('Audio URL received:', data.audio_url);
            const fullAudioUrl = `${API_BASE_URL}${data.audio_url}`;
            // Auto-play if enabled
            const autoPlay = getEl('autoPlayAudio');
            if (autoPlay && autoPlay.checked) {
                playAudio(fullAudioUrl);
            }
        }
        saveHistory();
    } catch (err) {
        showError('Error: ' + err.message);
    } finally {
        hideProcessing();
    }
}

// ===================================================
// MESSAGES
// ===================================================

function addMsg(sender, text, audioUrl = null) {
    const chat = getEl('chatMessages');
    if (!chat) return;
    
    const card = chat.querySelector('.welcome-card');
    if (card) card.remove();
    
    const div = document.createElement('div');
    div.className = 'message ' + sender;
    
    const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let content = `<div class="message-bubble">${esc(text)}`;
    
    // Add speaker button for bot messages with audio
    if (sender === 'bot' && audioUrl) {
        content += `<button class="play-btn" data-audio="${audioUrl}" title="Play response">🔊</button>`;
    }
    
    content += `</div><div class="message-time">${time}</div>`;
    div.innerHTML = content;
    
    // Add event listener for play button
    const playBtn = div.querySelector('.play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', toggleAudio);
    }
    
    chat.appendChild(div);
    
    const wrap = document.querySelector('.messages-wrapper');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function esc(t) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return t.replace(/[&<>"']/g, m => map[m]);
}

function playAudio(url) {
    console.log('🔊 Playing audio:', url);
    
    // Ensure URL is absolute (not relative)
    let fullUrl = url;
    if (!url.startsWith('http')) {
        fullUrl = `${API_BASE_URL}${url}`;
    }
    
    console.log('🔊 Full URL:', fullUrl);
    console.log('🔊 API_BASE_URL:', API_BASE_URL);
    
    // Only stop previous audio if it's a different URL or stop current one
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        // Don't reset currentTime here - let toggleAudio handle pause/resume
    }
    
    try {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.src = fullUrl;
        currentAudioPlayer = audio;
        
        audio.addEventListener('loadstart', () => console.log('Audio loading started'));
        audio.addEventListener('canplay', () => console.log('Audio can play'));
        audio.addEventListener('play', () => console.log('Audio playing'));
        audio.addEventListener('ended', () => {
            console.log('Audio ended');
            // Update button text when audio finishes
            const buttons = document.querySelectorAll('.play-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-audio') === url) {
                    btn.textContent = '🔊';
                    btn.title = 'Play response';
                }
            });
        });
        audio.addEventListener('error', (e) => {
            console.error('Audio error:', e.type, audio.error?.message);
        });
        
        audio.play().catch(e => console.error('Play error:', e.message));
    } catch (e) {
        console.error('Audio setup error:', e.message);
    }
}

function toggleAudio() {
    const url = this.getAttribute('data-audio');
    console.log('Toggle audio clicked with URL:', url);
    
    if (currentAudioPlayer && !currentAudioPlayer.paused) {
        // Pause (don't stop - preserve position)
        console.log('⏸️ Pausing audio at', currentAudioPlayer.currentTime, 'seconds');
        currentAudioPlayer.pause();
        this.textContent = '▶️';
        this.title = 'Resume audio';
    } else if (currentAudioPlayer && currentAudioPlayer.paused) {
        // Resume from where it was paused
        console.log('▶️ Resuming audio from', currentAudioPlayer.currentTime, 'seconds');
        currentAudioPlayer.play().catch(e => console.error('Resume error:', e.message));
        this.textContent = '⏸️';
        this.title = 'Pause audio';
    } else {
        // First time playing
        console.log('▶️ Starting new audio');
        playAudio(url);
        this.textContent = '⏸️';
        this.title = 'Pause audio';
    }
}

// ===================================================
// UI HELPERS
// ===================================================

function showError(msg) {
    const el = getEl('errorMessage');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
    console.error(msg);
}

function showProcessing() {
    const el = getEl('processingMessage');
    if (el) el.style.display = 'flex';
}

function hideProcessing() {
    const el = getEl('processingMessage');
    if (el) el.style.display = 'none';
}

function showTimer() {
    const el = getEl('timerContainer');
    if (el) el.style.display = 'flex';
}

function hideTimer() {
    const el = getEl('timerContainer');
    if (el) el.style.display = 'none';
}

function startTimer() {
    timerInterval = setInterval(() => {
        recordingDuration = Date.now() - recordingStartTime;
        const sec = Math.floor(recordingDuration / 1000);
        const ms = Math.floor((recordingDuration % 1000) / 10);
        
        const el = getEl('timerDisplay');
        if (el) {
            el.textContent = String(sec).padStart(2, '0') + ':' + String(ms).padStart(2, '0');
        }
    }, 50);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ===================================================
// SETTINGS
// ===================================================

function setupSettings() {
    const settingsBtn = getEl('settingsBtn');
    const closeBtn = getEl('closeSettingsBtn');
    const overlay = getEl('settingsOverlay');
    const darkMode = getEl('darkMode');
    const clearBtn = getEl('clearHistoryBtn');
    const micSens = getEl('micSensitivity');
    const senVal = getEl('sensitivityValue');
    
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    if (overlay) overlay.addEventListener('click', closeSettings);
    if (darkMode) darkMode.addEventListener('change', toggleDark);
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);
    if (micSens) {
        micSens.addEventListener('input', (e) => {
            if (senVal) senVal.textContent = e.target.value + '%';
            localStorage.setItem('micSensitivity', e.target.value);
        });
    }
}

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

function toggleDark() {
    const el = getEl('darkMode');
    document.body.classList.toggle('dark-mode');
    if (el) localStorage.setItem('darkMode', el.checked);
}

function loadSettings() {
    const autoPlay = localStorage.getItem('autoPlayAudio') !== 'false';
    const dark = localStorage.getItem('darkMode') === 'true';
    const sens = localStorage.getItem('micSensitivity') || '50';
    
    const apEl = getEl('autoPlayAudio');
    const darkEl = getEl('darkMode');
    const sensEl = getEl('micSensitivity');
    const senValEl = getEl('sensitivityValue');
    
    if (apEl) apEl.checked = autoPlay;
    if (darkEl) darkEl.checked = dark;
    if (sensEl) sensEl.value = sens;
    if (senValEl) senValEl.textContent = sens + '%';
    if (dark) document.body.classList.add('dark-mode');
}

function clearHistory() {
    if (confirm('Clear all messages?')) {
        const chat = getEl('chatMessages');
        if (chat) {
            chat.innerHTML = `<div class="welcome-card"><div class="welcome-icon">🎤</div><h2>Welcome</h2><p>Ready to chat</p></div>`;
        }
        localStorage.removeItem('chatHistory');
    }
}

// ===================================================
// HISTORY
// ===================================================

function saveHistory() {
    const chat = getEl('chatMessages');
    if (!chat) return;
    
    const msgs = [];
    chat.querySelectorAll('.message').forEach(el => {
        const text = el.querySelector('.message-bubble')?.textContent || '';
        const isUser = el.classList.contains('user');
        msgs.push({ sender: isUser ? 'user' : 'bot', text });
    });
    
    localStorage.setItem('chatHistory', JSON.stringify(msgs));
}

function loadHistory() {
    try {
        const saved = localStorage.getItem('chatHistory');
        if (!saved) return;
        const msgs = JSON.parse(saved);
        msgs.forEach(m => addMsg(m.sender, m.text));
    } catch (e) {
        console.error('History load error:', e);
    }
}

// ===================================================
// BACKEND CHECK
// ===================================================

async function checkBackend() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        const st = getEl('backendStatus');
        if (res.ok) {
            console.log('Backend online');
            if (st) {
                st.textContent = '✅ Online';
                st.style.color = 'var(--success)';
            }
        }
    } catch (err) {
        console.error('Backend offline:', err);
        const st = getEl('backendStatus');
        if (st) {
            st.textContent = 'Offline';
            st.style.color = 'var(--error)';
        }
    }
}

console.log('App.js loaded successfully');
