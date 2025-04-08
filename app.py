"""
Main Flask application for the Resume Optimizer.
"""
import os
import uuid
from flask import Flask, request, render_template, redirect, url_for, flash, send_file, session
from werkzeug.utils import secure_filename

# Import configuration
import config

# Import modules
from modules.resume_parser import parse_resume
from modules.job_analyzer import analyze_job_listing
from modules.optimizer import optimize_resume
from modules.docx_generator import generate_docx

app = Flask(__name__)
app.config['SECRET_KEY'] = config.SECRET_KEY
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS

@app.route('/')
def index():
    """Render the home page."""
    return render_template('index.html')

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    """Handle resume and job listing uploads."""
    if request.method == 'POST':
        # Check if resume file was uploaded
        if 'resume' not in request.files:
            flash('No resume file uploaded')
            return redirect(request.url)
        
        resume_file = request.files['resume']
        if resume_file.filename == '':
            flash('No resume selected')
            return redirect(request.url)
        
        # Check if job listing was provided
        job_listing = request.form.get('job_listing', '').strip()
        if not job_listing:
            flash('Job listing is required')
            return redirect(request.url)
        
        # Process the resume file
        if resume_file and allowed_file(resume_file.filename):
            # Generate a unique filename to prevent collisions
            original_filename = secure_filename(resume_file.filename)
            filename_base, filename_ext = os.path.splitext(original_filename)
            unique_filename = f"{filename_base}_{str(uuid.uuid4())}{filename_ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Save the file
            resume_file.save(filepath)
            
            # Store file path and job listing in session
            session['resume_path'] = filepath
            session['job_listing'] = job_listing
            session['original_filename'] = original_filename
            
            # Redirect to optimization process
            return redirect(url_for('optimize'))
        else:
            flash('Invalid file format. Please upload a .docx file.')
            return redirect(request.url)
    
    return render_template('upload.html')

@app.route('/optimize')
def optimize():
    """Process the resume and job listing to generate an optimized resume."""
    # Get file path and job listing from session
    resume_path = session.get('resume_path')
    job_listing = session.get('job_listing')
    
    if not resume_path or not job_listing:
        flash('Resume or job listing information missing')
        return redirect(url_for('upload'))
    
    try:
        # Parse the resume
        resume_data = parse_resume(resume_path)
        
        # Analyze the job listing
        job_data = analyze_job_listing(job_listing)
        
        # Optimize the resume
        optimized_resume = optimize_resume(resume_data, job_data)
        
        # Generate the optimized DOCX file
        original_filename = session.get('original_filename', 'resume')
        filename_base = os.path.splitext(original_filename)[0]
        output_filename = f"{filename_base}_optimized.docx"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        generate_docx(optimized_resume, output_path)
        
        # Store the output path in session
        session['output_path'] = output_path
        session['output_filename'] = output_filename
        
        return redirect(url_for('result'))
    
    except Exception as e:
        flash(f'Error optimizing resume: {str(e)}')
        return redirect(url_for('upload'))

@app.route('/result')
def result():
    """Show optimization results and provide download link."""
    output_path = session.get('output_path')
    output_filename = session.get('output_filename')
    
    if not output_path or not os.path.exists(output_path):
        flash('Optimized resume not found')
        return redirect(url_for('upload'))
    
    return render_template('result.html', filename=output_filename)

@app.route('/download')
def download():
    """Download the optimized resume."""
    output_path = session.get('output_path')
    output_filename = session.get('output_filename')
    
    if not output_path or not os.path.exists(output_path):
        flash('Optimized resume not found')
        return redirect(url_for('upload'))
    
    return send_file(output_path, as_attachment=True, download_name=output_filename)

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    flash('File too large. Maximum size is 16MB.')
    return redirect(url_for('upload'))

if __name__ == '__main__':
    app.run(debug=True)
