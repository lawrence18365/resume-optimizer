"""Job Analyzer Module - Simple version"""
import re

def analyze_job_listing(job_text):
    """Analyze job listing with basic extraction."""
    print("Using simplified job analyzer...")
    
    # Extract skills (common keywords)
    skills = []
    common_skills = ["python", "javascript", "html", "css", "communication", 
                     "teamwork", "leadership", "server", "hospitality", 
                     "food", "drink", "customer service", "detail", "professional"]
    
    for skill in common_skills:
        if skill.lower() in job_text.lower():
            skills.append(skill)
    
    # Extract additional skill phrases
    skill_phrases = re.findall(r'experience (?:with|in) ([\w\s,]+)', job_text.lower())
    for phrase in skill_phrases:
        for skill in phrase.split(','):
            clean_skill = skill.strip()
            if clean_skill and clean_skill not in skills:
                skills.append(clean_skill)
    
    # Create basic job data
    return {
        "required_skills": skills[:5],
        "preferred_skills": skills[5:] if len(skills) > 5 else [],
        "responsibilities": ["Responsibilities as listed in job description"],
        "company_values": ["Team collaboration", "Professional environment"],
        "keywords": skills,
        "experience_level": "As specified",
        "education": "As specified",
        "job_title": "Position"
    }
