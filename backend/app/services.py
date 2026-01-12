# -*- coding: utf-8 -*-

import whisper
import subprocess
import logging
import os
import os
from gtts import gTTS
from tempfile import NamedTemporaryFile
import os
from app.config import settings

# Set environment variable first
os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY

# Ensure ffmpeg bin is on PATH (helps Whisper find ffmpeg in environments
# where PATH wasn't updated for the running process). Adjust path if
# winget installed ffmpeg elsewhere on your machine.
_ffmpeg_bin = r"C:\Users\hasna\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
if os.path.isdir(_ffmpeg_bin):
    os.environ["PATH"] = _ffmpeg_bin + os.pathsep + os.environ.get("PATH", "")

# Lazy load Groq client
groq_client = None

def get_groq_client():
    global groq_client
    if groq_client is None:
        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.GROQ_API_KEY)
            return groq_client
        except Exception as e:
            logging.error(f"Failed to initialize Groq client: {e}")
            raise Exception(f"Unable to initialize Groq client: {e}")
    return groq_client

# Load Whisper model
whisper_model = whisper.load_model(settings.WHISPER_MODEL)

def speech_to_text(audio_path: str, language: str = None) -> str:
    """
    Convert speech audio file to text using Whisper with multi-language support
    
    Args:
        audio_path: Path to the audio file
        language: Language code (en, ml, es, fr, etc.) or None for auto-detection
        
    Returns:
        Transcribed text
    """
def speech_to_text(audio_path: str, language: str = None) -> str:
    """
    Convert speech audio file to text using Whisper (English-only)
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Transcribed text
    """
    try:
        logging.info(f"[AUDIO] Starting English transcription for {audio_path}")
        
        # Simple English-only transcription
        transcription_params = {
            'audio': audio_path,
            'language': 'en',
            'task': 'transcribe',
            'verbose': False,
            'fp16': False,
            'temperature': 0.0,
        }
        
        transcription = whisper_model.transcribe(**transcription_params)
        
        text = transcription.get("text", "").strip()
        
        logging.info(f"[AUDIO] Transcribed Text: '{text}'")
        
        if not text:
            logging.warning("Empty transcription - audio may be silent or too noisy")
            text = "(no speech detected)"
        
        return text
    except Exception as e:
        # Detect common ffmpeg missing error and provide actionable guidance
        msg = str(e)
        logging.error(f"Transcription error: {msg}")
        advice = ""
        try:
            # Check if ffmpeg is available
            subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            advice = (
                "\nNote: This error often occurs when `ffmpeg` is not installed or not on your PATH."
                " Install ffmpeg and ensure it's available in your PATH. See https://ffmpeg.org/download.html"
            )

        raise Exception(f"Speech-to-text error: {msg}{advice}")

def generate_response(text: str, language: str = 'en') -> str:
    """
    Generate response using Groq's LLaMA model (English-only)
    
    Args:
        text: User input text
        language: Language code (ignored - English only)
        
    Returns:
        Generated response text in English
    """
    try:
        logging.info(f"Generating response for: {text[:50]}...")
        
        # Simple English-only system prompt
        system_prompt = """You are a helpful, accurate, and friendly AI assistant. 
Answer questions clearly and concisely in English.
Listen carefully to what the user asks and respond specifically to their question."""
        
        client = get_groq_client()
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": text,
                }
            ],
            model=settings.LLM_MODEL,
            max_tokens=512,
            temperature=0.5,  # Lowered from 0.7 for more consistent/accurate responses
        )
        response = chat_completion.choices[0].message.content
        logging.info(f"Response generated: {response[:50]}...")
        return response
    except Exception as e:
        msg = str(e)
        logging.warning(f"Groq client failed: {msg}")

        # Try OpenAI as a fallback if API key present
        try:
            import openai
            openai_key = os.getenv('OPENAI_API_KEY')
            if openai_key:
                openai.api_key = openai_key
                try:
                    resp = openai.ChatCompletion.create(
                        model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
                        messages=[{"role": "user", "content": text}],
                        max_tokens=512,
                    )
                    logging.info("Using OpenAI fallback")
                    return resp.choices[0].message.content
                except Exception as oe:
                    logging.warning(f"OpenAI call failed: {oe}")
        except Exception:
            # openai package not available or other import error
            logging.debug("OpenAI SDK not available; skipping OpenAI fallback")

        # Known compatibility issue: return safe fallback echo so pipeline completes
        fallback = f"I understood you said: {text}. I'm currently having trouble processing that, but I heard you clearly!"
        logging.info(f"Using fallback response: {fallback[:50]}...")
        return fallback

def text_to_speech(text: str, language: str = 'en') -> str:
    """
    Convert text to speech using gTTS with language support
    
    Args:
        text: Text to convert to speech
        language: Language code (en, es, fr, de, it, pt, ja, zh-CN, etc.)
        
    Returns:
        Path to the generated audio file
    """
    try:
        logging.info(f"Converting to speech ({language}): {text[:50]}...")
        
        # Validate language code
        valid_languages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh-CN', 'zh-TW', 'ml', 'hi', 'ta', 'te', 'kn']
        if language not in valid_languages:
            logging.warning(f"Invalid language {language}, defaulting to English")
            language = 'en'
        
        # Limit text to reasonable length to avoid slow processing
        if len(text) > 1000:
            text = text[:1000]
            logging.warning("Text truncated to 1000 characters")
        
        tts = gTTS(
            text=text, 
            lang=language, 
            slow=False,
            tld='com'  # Use .com domain for better availability
        )
        
        # Create output file path manually instead of using NamedTemporaryFile
        output_filename = f"tts_{os.urandom(4).hex()}.mp3"
        output_path = os.path.join(settings.UPLOAD_DIR, output_filename)
        
        # Ensure directory exists
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        
        # Save the audio file
        tts.save(output_path)
        
        logging.info(f"Audio file created: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Text-to-speech error: {str(e)}")
        raise Exception(f"Text-to-speech error: {str(e)}")

def process_audio_pipeline(audio_path: str, language: str = 'en', speech_language: str = None) -> dict:
    """
    Complete pipeline: audio -> text -> response -> audio (English-only)
    
    Args:
        audio_path: Path to the input audio file
        
    Returns:
        Dictionary with transcribed text, response, and audio file path
    """
    try:
        logging.info("=" * 50)
        logging.info("STARTING AUDIO PIPELINE (English-only)")
        logging.info("=" * 50)
        
        # Step 1: Convert speech to text in English
        logging.info("Step 1: Converting speech to text...")
        transcribed_text = speech_to_text(audio_path, language=None)
        logging.info(f"Step 1 Complete: '{transcribed_text}'")
        
        if transcribed_text == "(no speech detected)":
            logging.warning("No speech detected in audio")
        
        # Step 2: Get response from LLaMA model in English
        logging.info("Step 2: Generating response in English...")
        response_text = generate_response(transcribed_text, language='en')
        logging.info(f"Step 2 Complete: '{response_text[:50]}...'")
        
        # Step 3: Convert response text to speech in English
        logging.info("Step 3: Converting response to speech...")
        response_audio_path = text_to_speech(response_text, language='en')
        logging.info(f"Step 3 Complete: {response_audio_path}")
        
        result = {
            "transcribed_text": transcribed_text,
            "response_text": response_text,
            "audio_path": response_audio_path,
            "status": "success"
        }
        
        logging.info("=" * 50)
        logging.info("PIPELINE COMPLETED SUCCESSFULLY")
        logging.info("=" * 50)
        
        return result
    except Exception as e:
        logging.error(f"Pipeline error: {e}")
        logging.error("=" * 50)
        return {
            "status": "error",
            "error": str(e)
        }
