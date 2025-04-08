"""
Configuration settings for the Resume Optimizer application.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Gemini API settings
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-1.5-pro"

if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("AIzaSyAtmgZ2NpkyMZD6Qz1EdCjMH4uc0IwL6yI"):
    raise ValueError("ERROR: Gemini API key is missing or placeholder. Please set GEMINI_API_KEY environment variable.")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    _model = genai.GenerativeModel(GEMINI_MODEL)
    _model.generate_content(
        "ping",
        generation_config={"temperature": 0.0, "max_output_tokens": 10}
    )
except Exception as e:
    raise RuntimeError(f"Gemini API key validation failed: {str(e)}")

# Flask application settings
SECRET_KEY = os.getenv("SECRET_KEY", "resume-optimizer-secret-key")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"docx"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload size

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Resume optimization settings
OPTIMIZATION_TEMPERATURE = 0.2  # Low temperature for more focused responses
MAX_OUTPUT_TOKENS = 8192  # Maximum output token length

# Resume template settings
DEFAULT_TEMPLATE = "professional"  # Default resume template style
