"""
Resume Optimizer Module - Uses Gemini API to generate an optimized resume.
"""

import json
import google.generativeai as genai
import config

# Initialize Gemini API
genai.configure(api_key=config.GEMINI_API_KEY)
model = genai.GenerativeModel(config.GEMINI_MODEL)

RESUME_OPTIMIZATION_PROMPT = """
You are a professional resume consultant. Using the candidate's resume and the job listing analysis:
1. Rewrite the professional summary to align with the job
2. Prioritize skills most relevant to the position
3. Enhance work experience descriptions to highlight relevant achievements
4. Add industry keywords naturally throughout
5. Maintain authenticity while maximizing job-specific relevance

Candidate Resume (JSON):
{resume_json}

Job Listing Analysis (JSON):
{job_json}

Output a complete, optimized resume structure as JSON.
"""

def optimize_resume(resume_data, job_data):
    """
    Optimize a resume using Gemini API based on job listing analysis.
    
    Args:
        resume_data (dict): Parsed resume data.
        job_data (dict): Parsed job listing data.
        
    Returns:
        dict: Optimized resume data.
    """
    prompt = RESUME_OPTIMIZATION_PROMPT.format(
        resume_json=json.dumps(resume_data, indent=2),
        job_json=json.dumps(job_data, indent=2)
    )
    
    try:
        print("[Optimizer] Sending prompt to Gemini API...")
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": config.OPTIMIZATION_TEMPERATURE,
                "max_output_tokens": config.MAX_OUTPUT_TOKENS
            }
        )
        content = response.text.strip()
        print("[Optimizer] Gemini API response received.")
        optimized_resume = json.loads(content)
        return optimized_resume
    
    except json.JSONDecodeError:
        print("[Optimizer] Failed to parse JSON from Gemini response.")
        print(content)
        # Fallback: return original resume data with warning
        fallback = resume_data.copy()
        fallback['warning'] = "Gemini API response could not be parsed. Returning original resume data."
        return fallback
    
    except Exception as e:
        print(f"[Optimizer] Error during Gemini API call: {str(e)}")
        # Fallback: return original resume data with warning
        fallback = resume_data.copy()
        fallback['warning'] = f"Gemini API call failed: {str(e)}. Returning original resume data."
        return fallback
