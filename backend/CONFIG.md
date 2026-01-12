# Backend Configuration Guide

## Environment Variables (.env)

Create a `.env` file in the backend directory with the following variables:

### Required
```env
GROQ_API_KEY=your_groq_api_key_here
```

### Optional
```env
WHISPER_MODEL=base              # tiny, base, small, medium, large
LLM_MODEL=llama3-8b-8192       # Groq model selection
BACKEND_URL=http://localhost:8000
```

## Whisper Models

- **tiny**: Fastest, least accurate (39M parameters)
- **base**: Good balance (74M parameters) - Recommended for most users
- **small**: Better accuracy (244M parameters)
- **medium**: High accuracy (769M parameters)
- **large**: Highest accuracy (1550M parameters) - Requires more memory

## Getting Groq API Key

1. Go to https://console.groq.com
2. Create an account or sign in
3. Navigate to API Keys
4. Create new API key
5. Copy the key and paste in `.env`

## Performance Tips

1. **First Run**: The first request will be slower as models are downloaded
2. **Model Size**: Larger models are more accurate but slower
3. **GPU**: Models run faster with GPU (if available)
4. **API Rate Limits**: Check Groq's current rate limits

## Troubleshooting

**KeyError: 'GROQ_API_KEY'**
- Make sure .env file exists and is in the backend directory
- Check that API key is spelled correctly
- Restart the backend after changes

**ModuleNotFoundError**
- Activate virtual environment
- Run `pip install -r requirements.txt`

**Model Download Failed**
- Check internet connection
- Try smaller model (tiny/base)
- Ensure sufficient disk space

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py         # Load .env variables
│   ├── models.py         # Data models
│   ├── routes.py         # API routes
│   └── services.py       # AI services
├── main.py               # Application entry point
├── requirements.txt      # Dependencies
├── .env                  # Your API key (create this)
├── .env.example          # Template
└── uploads/              # Temporary files (auto-created)
```

## CORS Configuration

The backend allows all origins by default:
```python
allow_origins=["*"]
```

For production, update in `app/main.py`:
```python
allow_origins=["https://yourdomain.com"]
```
