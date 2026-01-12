# -*- coding: utf-8 -*-

from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse
import os
import uuid
import logging
import traceback
from app.services import speech_to_text, generate_response, text_to_speech, process_audio_pipeline
from app.config import settings

logger = logging.getLogger("voice_chatbot")
router = APIRouter()

@router.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio file to text
    """
    try:
        if not file.filename.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac')):
            raise HTTPException(status_code=400, detail="Invalid audio format")
        
        # Save uploaded file temporarily
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        with open(file_path, "wb") as f:
            content = await file.read()
            if len(content) > settings.MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File too large")
            f.write(content)
        
        # Transcribe
        transcribed_text = speech_to_text(file_path)
        
        # Clean up
        os.remove(file_path)
        
        return {
            "status": "success",
            "transcribed_text": transcribed_text
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "error": str(e)}

@router.post("/api/chat")
async def chat(message: dict):
    """
    Get chat response from LLM (English-only)
    """
    try:
        if "message" not in message:
            raise HTTPException(status_code=400, detail="Message field required")
        
        # Generate response in English
        response_text = generate_response(message["message"], language='en')
        
        # Generate TTS audio in English
        audio_path = text_to_speech(response_text, language='en')
        
        return {
            "status": "success",
            "response": response_text,
            "audio_url": f"/api/audio/{os.path.basename(audio_path)}"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@router.post("/api/text-to-speech")
async def convert_text_to_speech(data: dict):
    """
    Convert text to speech (English-only)
    """
    try:
        if "text" not in data:
            raise HTTPException(status_code=400, detail="Text field required")
        
        # Convert to speech in English
        audio_path = text_to_speech(data["text"], language='en')
        
        return {
            "status": "success",
            "audio_url": f"/api/audio/{os.path.basename(audio_path)}"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@router.post("/api/process")
async def process_voice_chat(request: Request):
    """
    Complete pipeline: transcribe -> chat -> generate speech with language support
    Accepts multipart/form-data with 'file' field and optional 'language' field
    """
    try:
        # Parse multipart form data
        form = await request.form()
        
        if 'file' not in form:
            logger.error(" 'file' field missing from form data")
            raise HTTPException(status_code=400, detail="'file' field required")
        
        file: UploadFile = form['file']
        
        # English-only pipeline
        logger.info(f"Received file: {file.filename}")
        
        if not file.filename.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac', '.webm')):
            logger.error(f" Invalid audio format: {file.filename}")
            raise HTTPException(status_code=400, detail=f"Invalid audio format: {file.filename}")
        
        # Save uploaded file temporarily
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        with open(file_path, "wb") as f:
            content = await file.read()
            logger.info(f"File size: {len(content)} bytes")
            if len(content) > settings.MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File too large")
            f.write(content)
        
        logger.info(f"File saved to: {file_path}")
        
        # Process through English-only pipeline
        try:
            result = process_audio_pipeline(file_path, language='en', speech_language=None)
        except Exception as e:
            # Clean up input file
            try:
                os.remove(file_path)
            except Exception:
                pass
            logger.exception("Error during process_audio_pipeline")
            tb = traceback.format_exc()
            raise HTTPException(status_code=500, detail={"error": str(e), "trace": tb})

        # Clean up input file
        try:
            os.remove(file_path)
        except Exception:
            pass

        if result.get("status") == "success":
            logger.info("Pipeline completed successfully")
            return {
                "status": "success",
                "transcribed_text": result["transcribed_text"],
                "response_text": result["response_text"],
                "audio_url": f"/api/audio/{os.path.basename(result['audio_path'])}"
            }
        else:
            # Log and return error
            logger.error("Processing failed: %s", result.get("error"))
            raise HTTPException(status_code=500, detail=result.get("error", "Processing failed"))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unhandled error in /api/process: {str(e)}")
        return {"status": "error", "error": str(e)}

@router.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """
    Retrieve generated audio file
    """
    try:
        logger.info(f"Requesting audio file: {filename}")
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        logger.info(f"Looking for file at: {file_path}")
        
        if not os.path.exists(file_path):
            logger.error(f"Audio file not found: {file_path}")
            raise HTTPException(status_code=404, detail=f"Audio file not found: {filename}")
        
        logger.info(f"Returning audio file: {file_path}")
        return FileResponse(file_path, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving audio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "ok", "service": "voice-chatbot-backend"}
