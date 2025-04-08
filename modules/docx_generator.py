"""
DOCX Generator Module - Creates a resume DOCX file from optimized resume data.
"""

import docx

def generate_docx(optimized_resume, output_path):
    """
    Generate a DOCX resume from optimized resume data.
    
    Args:
        optimized_resume (dict): Optimized resume content.
        output_path (str): Path to save the generated DOCX file.
    """
    doc = docx.Document()
    
    # Contact Info
    contact = optimized_resume.get('contact_info', {})
    name = contact.get('name', '')
    email = contact.get('email', '')
    phone = contact.get('phone', '')
    location = contact.get('location', '')
    linkedin = contact.get('linkedin', '')
    website = contact.get('website', '')
    
    doc.add_heading(name, level=0)
    contact_lines = []
    if email:
        contact_lines.append(email)
    if phone:
        contact_lines.append(phone)
    if location:
        contact_lines.append(location)
    if linkedin:
        contact_lines.append(linkedin)
    if website:
        contact_lines.append(website)
    doc.add_paragraph(' | '.join(contact_lines))
    
    # Summary
    summary = optimized_resume.get('summary', '')
    if summary:
        doc.add_heading('Professional Summary', level=1)
        doc.add_paragraph(summary)
    
    # Skills
    skills = optimized_resume.get('skills', [])
    if skills:
        doc.add_heading('Skills', level=1)
        doc.add_paragraph(', '.join(skills))
    
    # Experience
    experience = optimized_resume.get('experience', [])
    if experience:
        doc.add_heading('Work Experience', level=1)
        for exp in experience:
            p = doc.add_paragraph()
            p.add_run(exp.get('title', '')).bold = True
            p.add_run(' at ' + exp.get('company', '')).italic = True
            p.add_run(' (' + exp.get('date_range', '') + ')')
            for desc in exp.get('description', []):
                doc.add_paragraph(desc, style='List Bullet')
    
    # Education
    education = optimized_resume.get('education', [])
    if education:
        doc.add_heading('Education', level=1)
        for edu in education:
            p = doc.add_paragraph()
            p.add_run(edu.get('degree', '')).bold = True
            p.add_run(' at ' + edu.get('institution', '')).italic = True
            p.add_run(' (' + edu.get('date_range', '') + ')')
            for detail in edu.get('details', []):
                doc.add_paragraph(detail, style='List Bullet')
    
    # Projects
    projects = optimized_resume.get('projects', '')
    if projects:
        doc.add_heading('Projects', level=1)
        doc.add_paragraph(projects)
    
    # Certifications
    certifications = optimized_resume.get('certifications', '')
    if certifications:
        doc.add_heading('Certifications', level=1)
        doc.add_paragraph(certifications)
    
    # Languages
    languages = optimized_resume.get('languages', '')
    if languages:
        doc.add_heading('Languages', level=1)
        doc.add_paragraph(languages)
    
    # Interests
    interests = optimized_resume.get('interests', '')
    if interests:
        doc.add_heading('Interests', level=1)
        doc.add_paragraph(interests)
    
    # Save the document
    doc.save(output_path)
