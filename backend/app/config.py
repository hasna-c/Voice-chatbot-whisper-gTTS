# -*- coding: utf-8 -*-

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "your_groq_api_key")
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")  # Using "base" model - optimized for English
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama3-8b")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 25 * 1024 * 1024  # 25MB
    
    def __init__(self):
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)

settings = Settings()
