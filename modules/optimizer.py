"""Resume Optimizer Module - Simple version"""

def optimize_resume(resume_data, job_data):
    """Create an optimized resume directly."""
    print("Using simplified resume optimizer...")
    
    # Create deep copy of the resume data to avoid structure loss
    import copy
    optimized = copy.deepcopy(resume_data)
    
    # Get job skills and current skills
    job_skills = job_data.get('required_skills', [])
    current_skills = optimized.get('skills', [])
    
    # Add job skills to resume skills
    for skill in job_skills:
        if skill not in current_skills:
            current_skills.append(skill)
    
    optimized['skills'] = current_skills
    
    # Enhance summary
    skill_text = ', '.join(job_skills[:3]) if job_skills else "relevant skills"
    if optimized.get('summary'):
        optimized['summary'] = f"Professional with expertise in {skill_text}. " + optimized.get('summary')
    else:
        optimized['summary'] = f"Professional with expertise in {skill_text} seeking new opportunities."
    
    # Add optimization note
    optimized['_optimization_note'] = "Basic optimization applied"
    return optimized
