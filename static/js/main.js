/**
 * Resume Optimizer JavaScript functionality
 * 
 * Note: All session data is handled server-side via Flask.
 * This script does NOT use localStorage or sessionStorage to avoid browser storage errors.
 */

// Defensive override to disable storage access in case any other script tries to use it
try {
    Object.defineProperty(window, 'localStorage', {
        get: function() { throw new Error('localStorage is disabled in this app'); }
    });
    Object.defineProperty(window, 'sessionStorage', {
        get: function() { throw new Error('sessionStorage is disabled in this app'); }
    });
} catch (e) {
    // Ignore if override fails
}

document.addEventListener('DOMContentLoaded', function() {
    // Auto-dismiss flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(function(alert) {
        setTimeout(function() {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
    
    // File upload validation
    const resumeInput = document.getElementById('resume');
    if (resumeInput) {
        resumeInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                // Check file extension
                const fileName = file.name;
                const fileExt = fileName.split('.').pop().toLowerCase();
                
                if (fileExt !== 'docx') {
                    alert('Please upload a DOCX file only.');
                    this.value = ''; // Clear the file input
                    return;
                }
                
                // Check file size (max 16MB)
                const maxSize = 16 * 1024 * 1024; // 16MB in bytes
                if (file.size > maxSize) {
                    alert('File size exceeds 16MB. Please upload a smaller file.');
                    this.value = ''; // Clear the file input
                    return;
                }
            }
        });
    }
    
    // Job listing textarea character count
    const jobListingTextarea = document.getElementById('job_listing');
    if (jobListingTextarea) {
        jobListingTextarea.addEventListener('input', function() {
            const minLength = 100;
            const currentLength = this.value.length;
            
            if (currentLength < minLength) {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            } else {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    }
    
    // Form validation before submission
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            let isValid = true;
            
            // Validate resume file
            if (resumeInput && (!resumeInput.files || resumeInput.files.length === 0)) {
                isValid = false;
                alert('Please select a resume file to upload.');
            }
            
            // Validate job listing
            if (jobListingTextarea && jobListingTextarea.value.length < 100) {
                isValid = false;
                alert('Please enter a more detailed job description (minimum 100 characters).');
                jobListingTextarea.focus();
            }
            
            if (!isValid) {
                event.preventDefault();
                return false;
            }
            
            // Show loading state
            const loadingSpinner = document.getElementById('loading-spinner');
            const submitButton = document.getElementById('submit-btn');
            
            if (loadingSpinner && submitButton) {
                loadingSpinner.classList.remove('d-none');
                submitButton.disabled = true;
                submitButton.innerHTML = 'Processing... This may take a minute';
            }
            
            return true;
        });
    }
    
    // Download button auto-click on result page after 2 seconds
    const downloadButton = document.querySelector('a[href*="download"]');
    if (downloadButton && window.location.pathname.includes('/result')) {
        setTimeout(function() {
            downloadButton.click();
        }, 2000);
    }
});
