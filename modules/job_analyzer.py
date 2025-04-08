"""
Job Analyzer Module - Uses Gemini API to extract structured data from job listings.
"""

import json
import google.generativeai as genai
import config

# Initialize Gemini API
genai.configure(api_key=config.GEMINI_API_KEY)
model = genai.GenerativeModel(config.GEMINI_MODEL)

JOB_ANALYSIS_PROMPT = """
You are an expert job analyzer. Extract from this job listing:
1. Required skills and qualifications
2. Key responsibilities
3. Company values and culture indicators
4. Industry-specific keywords and terminology
5. Preferred qualifications

Output as a structured JSON object with categorized requirements.
Job Listing:
\"\"\"
{job_text}
\"\"\"
"""

def analyze_job_listing(job_text):
    """
    Analyze a job listing using Gemini API and extract structured data.
    
    Args:
        job_text (str): The job description text.
        
    Returns:
        dict: Extracted job requirements and details.
    """
    prompt = JOB_ANALYSIS_PROMPT.format(job_text=job_text)
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": config.OPTIMIZATION_TEMPERATURE,
                "max_output_tokens": config.MAX_OUTPUT_TOKENS
            }
        )
        # Gemini returns a response object with text content
        content = response.text.strip()
        
        # Attempt to parse JSON from the response
        job_data = json.loads(content)
        return job_data
    
    except json.JSONDecodeError:
        raise Exception("Failed to parse JSON from Gemini response:\n" + content)
    except Exception as e:
        raise Exception(f"Error analyzing job listing: {str(e)}")
