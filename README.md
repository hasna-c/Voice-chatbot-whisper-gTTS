# Voice AI Chatbot

A fully functional English-only voice-to-voice AI chatbot that converts speech to text, generates intelligent responses using LLaMA, and converts responses back to speech.

## Features

- Voice Input: Record audio directly from your microphone
- Real-time Transcription: Convert speech to text using OpenAI Whisper (base model)
- AI Responses: Get intelligent answers powered by Groq's LLaMA 3 (8B)
- Voice Output: Hear responses via Google Text-to-Speech (gTTS)
- Dark Mode: Comfortable dark theme for extended use
- Chat History: View all your conversations in one place
- Customizable Settings: Adjust microphone sensitivity and auto-play preferences
- Lightweight & Fast: Optimized for English-only performance

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VOICE AI CHATBOT SYSTEM                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   FRONTEND       │
                              │  (Port 3000)     │
                              │   HTML/CSS/JS    │
                              └────────┬─────────┘
                                       │
                   ┌───────────────────┼───────────────────┐
                   │                   │                   │
            ┌──────▼──────┐   ┌────────▼────────┐   ┌─────▼──────┐
            │  User Input  │   │  Text Message   │   │   Settings │
            │  (Microphone)│   │  (Typing)       │   │  Management│
            └──────┬──────┘   └────────┬────────┘   └─────▲──────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   API Gateway   │
                              │  (FastAPI)      │
                              │  (Port 8000)    │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   ┌────▼─────────┐         ┌──────────▼──────────┐         ┌────────▼────┐
   │  SPEECH TO   │         │   LLM RESPONSE      │         │  TEXT TO    │
   │   TEXT       │         │   GENERATION        │         │   SPEECH    │
   │  (Whisper)   │         │   (LLaMA 3 - 8B)    │         │  (gTTS)     │
   └────┬─────────┘         └──────────┬──────────┘         └────────┬────┘
        │                              │                             │
   ┌────▼─────────────┐        ┌──────▼──────────┐         ┌────────▼────┐
   │ Audio Input File │        │  Groq API Key   │         │  MP3 Audio  │
   │ Processing       │        │  (Cloud LLM)    │         │  Generation │
   └────┬─────────────┘        └──────┬──────────┘         └────────┬────┘
        │                             │                             │
        │                      ┌──────▼──────────┐                  │
        │                      │   Response Text │                  │
        │                      └──────┬──────────┘                  │
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │  CHAT RESPONSE │
                              │  + Audio File  │
                              │  (Sent to UI)  │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │   USER HEARS   │
                              │   RESPONSE     │
                              │   (Auto-play)  │
                              └────────────────┘
```

## Complete Data Flow

```
USER SPEAKS/TYPES
       ▼
┌─────────────────┐
│  FRONTEND       │ → Records audio or accepts text
│  (React-like)   │
└────────┬────────┘
         │
         ▼
    ┌────────────────────────┐
    │  SEND TO BACKEND       │
    │  /api/process (voice)  │
    │  /api/chat (text)      │
    └────────┬───────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │  BACKEND PROCESSING      │
    │  (FastAPI + Python)      │
    └────────┬─────────────────┘
             │
    ┌────────▼──────────────┐
    │ 1. SPEECH TO TEXT     │
    │    (Whisper Base)     │
    └────────┬──────────────┘
             │
             ▼ "What is statistics?"
    ┌──────────────────────────┐
    │ 2. GENERATE RESPONSE     │
    │    (Groq LLaMA 3)        │
    └────────┬──────────────────┘
             │
             ▼ "Statistics is the science of..."
    ┌──────────────────────────┐
    │ 3. TEXT TO SPEECH        │
    │    (Google gTTS)         │
    └────────┬──────────────────┘
             │
             ▼ MP3 Audio File
    ┌──────────────────────────┐
    │ RETURN RESPONSE          │
    │ - Text + Audio URL       │
    └────────┬──────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ DISPLAY & PLAY           │
    │ - Show text message      │
    │ - Play audio response    │
    └──────────────────────────┘
```

## Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with dark mode support
- **JavaScript (ES6+)** - Interactive UI and voice recording
- **Web Audio API** - Microphone access and recording
- **MediaRecorder API** - Audio encoding

### Backend
- **FastAPI** - High-performance Python web framework
- **Python 3.x** - Core language
- **OpenAI Whisper (base)** - Speech-to-text recognition
- **Groq LLaMA 3 (8B)** - Large language model for responses
- **Google gTTS** - Text-to-speech synthesis
- **Uvicorn** - ASGI server

### APIs & Services
- **Groq API** - Cloud-based LLM inference
- **Google Text-to-Speech** - Voice synthesis
- **OpenAI Whisper** - Local speech recognition


### Prerequisites
- Python 3.8+
- Node.js (optional, if using npm)
- Microphone enabled on your system
- Internet connection (for Groq API and gTTS)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Voice-chatbot
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows
```

3. **Install dependencies**
```bash
cd backend
pip install -r requirements.txt
```

4. **Set environment variables**
Create `.env` file in the `backend` directory:
```
GROQ_API_KEY=your_groq_api_key_here
WHISPER_MODEL=base
LLM_MODEL=llama-3-8b-instant
```

Get your Groq API key from: https://console.groq.com

5. **Start backend server**
```bash
cd backend
python main.py
```
Server runs on `http://localhost:8000`

6. **Start frontend server** (in another terminal)
```bash
cd frontend
python -m http.server 3000
```
Access app at `http://localhost:3000`

## How to Use

1. **Open the app** at `http://localhost:3000`
2. **Choose input method**:
   - **Voice**: Press and hold the 🎤 button to record
   - **Text**: Type in the message box
3. **Get response**: The AI will respond with text and audio
4. **Adjust settings**: Use ⚙️ icon for dark mode and other options

##  API Endpoints

### `/api/process` (POST)
Complete voice pipeline: transcribe → respond → synthesize
```json
{
  "file": "audio.wav",
  "language": "en"
}
```

### `/api/chat` (POST)
Text-based chat endpoint
```json
{
  "message": "What is AI?",
  "language": "en"
}
```

### `/api/transcribe` (POST)
Convert audio to text only
```json
{
  "file": "audio.wav"
}
```

### `/api/text-to-speech` (POST)
Convert text to audio only
```json
{
  "text": "Hello world",
  "language": "en"
}
```

## Configuration

Edit `backend/app/config.py` to customize:
- WHISPER_MODEL: Change speech recognition model
- LLM_MODEL: Change LLM model
- MAX_FILE_SIZE: Maximum upload size
- UPLOAD_DIR: Temporary audio file location

## Project Structure

```
Voice-chatbot/
├── frontend/
│   ├── index.html          # Main UI
│   ├── app.js              # Frontend logic
│   ├── styles.css          # Styling
│   └── uploads/            # Temporary files
│
├── backend/
│   ├── main.py             # FastAPI app entry
│   ├── app/
│   │   ├── config.py       # Configuration
│   │   ├── routes.py       # API endpoints
│   │   ├── services.py     # Core logic
│   │   └── models.py       # Data models
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Environment variables
│
├── README.md               # This file
└── .gitignore

```

## Features Explained

### Microphone Recording
- Click and hold the microphone button to record
- Visual timer shows recording duration
- Automatic silence detection
- Adjustable microphone sensitivity

### AI Intelligence
- Uses LLaMA 3 (8B) model for accurate responses
- Optimized for conversational English
- Context-aware answers
- Low latency responses

### Natural Voice Output
- Google TTS for natural sounding audio
- Auto-play option for seamless experience
- Download audio option

### Dark Mode
- Easy on the eyes for extended usage
- Toggle in settings
- Preference saved locally

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Microphone not working | Check browser permissions, ensure mic is enabled |
| No transcription | Check audio quality, speak clearly, adjust sensitivity |
| API errors | Verify Groq API key in .env file |
| Audio not playing | Enable auto-play or click play button manually |
| Slow responses | Check internet connection and Groq API status |

## Performance

- Transcription: ~2-3 seconds (Whisper base)
- LLM Response: ~1-2 seconds (Groq API)
- Text-to-Speech: ~1-2 seconds (gTTS)
- Total Round Trip: ~4-7 seconds

## Privacy

- Audio files are temporarily stored and deleted after processing
- No audio data is permanently saved
- All processing happens in real-time
- Your Groq API key is stored locally in `.env`

## License

This project is open source and available under the MIT License.

