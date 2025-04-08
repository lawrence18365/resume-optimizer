"""
Test script to validate Gemini API connectivity and API key.
"""

import os
import google.generativeai as genai

API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

if not API_KEY or API_KEY.startswith("AIzaSyAtmgZ2NpkyMZD6Qz1EdCjMH4uc0IwL6yI"):
    print("ERROR: Gemini API key is missing or placeholder. Please set GEMINI_API_KEY environment variable.")
    exit(1)

try:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel("gemini-1.5-pro")
    response = model.generate_content(
        "Say hello",
        generation_config={
            "temperature": 0.2,
            "max_output_tokens": 100
        }
    )
    print("Gemini API test successful. Response:")
    print(response.text.strip())
except Exception as e:
    print("Gemini API test failed with error:")
    print(str(e))
    exit(1)
