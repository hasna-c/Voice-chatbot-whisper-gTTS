# -*- coding: utf-8 -*-

from pydantic import BaseModel
from typing import Optional

class TranscriptionResponse(BaseModel):
    text: str
    confidence: Optional[float] = None

class ChatResponse(BaseModel):
    content: str
    model: str

class ChatbotResponse(BaseModel):
    transcribed_text: str
    response_text: str
    audio_path: str
    status: str = "success"
