import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';

dotenv.config();

const app = express();

/**
 * Transform AI response JSON to match expected document generator format.
 */
function transformAIResponse(aiResponse: any, originalResumeData: any) {
  const transformed: any = {
    contact_info: originalResumeData?.contact_info || {},
    summary: aiResponse.summary || '',
    skills: aiResponse.skills || [],
    experience: [],
    education: []
  };

  for (const job of aiResponse.workExperience || []) {
    transformed.experience.push({
      title: job.position || '',
      company: job.company || '',
      location: '', // Not provided
      date_range: job.duration || '',
      description: job.bullets || []
    });
  }

  for (const edu of aiResponse.education || []) {
    transformed.education.push({
      degree: edu.degree || '',
      institution: edu.institution || '',
      date_range: edu.date_range || '',
      details: edu.details || []
    });
  }

  return transformed;
}
/**
 * Basic fallback optimizer if AI response fails
 */
function fallbackOptimizeResume(resumeText: string, jobDescription: string) {
  const fallback: {
    contact_info: any;
    summary: string;
    skills: string[];
    experience: any[];
    education: any[];
    _optimization_note?: string;
  } = {
    contact_info: {},
    summary: '',
    skills: [],
    experience: [],
    education: []
  };

  // Extract some skills from job description (very basic keyword extraction)
  const skillMatches = jobDescription.match(/\b[A-Za-z\+\#]{2,}\b/g) || [];
  const uniqueSkills = Array.from(new Set(skillMatches)).slice(0, 10);
  fallback.skills = uniqueSkills;

  // Create a simple summary
  const skillText = uniqueSkills.slice(0, 3).join(', ') || 'relevant skills';
  fallback.summary = `Professional with expertise in ${skillText}.`;

  // Add optimization note
  (fallback as any)._optimization_note = 'Fallback optimization applied due to AI failure';

  return fallback;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Get cached AI response or generate a new one
 */
async function getCachedOrNewAIResponse(resumeText: string, jobDescription: string, fetchAIResponse: () => Promise<string>): Promise<string> {
  const cacheDir = path.join(__dirname, '../../cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const hash = crypto.createHash('md5').update(resumeText + jobDescription).digest('hex');
  const cacheFile = path.join(cacheDir, `${hash}.json`);

  // Check if cache exists and is fresh (<24h)
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      try {
        const cached = fs.readFileSync(cacheFile, 'utf-8');
        return cached;
      } catch (e) {
        console.warn('Failed to read cache, regenerating...');
      }
    }
  }

  // Generate new response
  const aiResponse = await fetchAIResponse();

  // Cache it
  try {
    fs.writeFileSync(cacheFile, aiResponse, 'utf-8');
  } catch (e) {
    console.warn('Failed to write cache:', e);
  }

  return aiResponse;
}

/**
 * Basic resume text parser to extract contact info, skills, experience, education
 */
function parseResumeText(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  const data: any = {
    contact_info: {},
    skills: [],
    experience: [],
    education: []
  };

  // Extract email and phone
  for (const line of lines) {
    if (!data.contact_info.email) {
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) data.contact_info.email = emailMatch[0];
    }
    if (!data.contact_info.phone) {
      const phoneMatch = line.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?){1,2}\d{4}/);
      if (phoneMatch) data.contact_info.phone = phoneMatch[0];
    }
  }

  // Extract name (first non-empty line)
  if (lines.length > 0) {
    data.contact_info.name = lines[0];
  }

  // Extract skills (lines after "Skills" header)
  const skillsIdx = lines.findIndex(l => /skills/i.test(l));
  if (skillsIdx !== -1) {
    for (let i = skillsIdx + 1; i < lines.length; i++) {
      if (/experience|education/i.test(lines[i])) break;
      const skillLine = lines[i].replace(/[-•*]/g, '').trim();
      if (skillLine) {
        data.skills.push(...skillLine.split(/,|\s{2,}/).map(s => s.trim()).filter(s => s));
      }
    }
    data.skills = Array.from(new Set(data.skills));
  }

  // Extract experience (lines after "Experience" header)
  const expIdx = lines.findIndex(l => /experience/i.test(l));
  if (expIdx !== -1) {
    let currentJob: any = null;
    for (let i = expIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/education/i.test(line)) break;

      if (/^\w.+ at .+$/i.test(line)) {
        if (currentJob) data.experience.push(currentJob);
        const [titlePart, companyPart] = line.split(' at ');
        currentJob = { title: titlePart.trim(), company: companyPart.trim(), date_range: '', description: [] };
      } else if (/\d{4}/.test(line)) {
        if (currentJob) currentJob.date_range = line.trim();
      } else if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
        if (currentJob) currentJob.description.push(line.replace(/[-•*]/, '').trim());
      }
    }
    if (currentJob) data.experience.push(currentJob);
  }

  // Extract education (lines after "Education" header)
  const eduIdx = lines.findIndex(l => /education/i.test(l));
  if (eduIdx !== -1) {
    let currentEdu: any = null;
    for (let i = eduIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/experience/i.test(line)) break;

      if (/degree|bachelor|master|phd|associate/i.test(line)) {
        if (currentEdu) data.education.push(currentEdu);
        currentEdu = { degree: line.trim(), institution: '', date_range: '', details: [] };
      } else if (/\d{4}/.test(line)) {
        if (currentEdu) currentEdu.date_range = line.trim();
      } else {
        if (currentEdu) {
          if (!currentEdu.institution) currentEdu.institution = line.trim();
          else currentEdu.details.push(line.trim());
        }
      }
    }
    if (currentEdu) data.education.push(currentEdu);
  }

  return data;
}

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Backend is running' });
});

// Upload and parse resume
app.post('/api/upload', upload.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const buffer = req.file.buffer;
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    const structured = parseResumeText(text);

    res.json({ success: true, text, structured });
  } catch (error: any) {
    console.error('Resume parsing failed:', error);
    res.status(500).json({ success: false, error: 'Failed to parse resume' });
  }
});

// AI optimization with OpenAI and DeepSeek
app.post('/api/optimize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { resumeText, jobDescription } = req.body;
    const provider = req.query.provider || 'deepseek';

    if (!resumeText || !jobDescription) {
      res.status(400).json({ success: false, error: 'Missing resumeText or jobDescription' });
      return;
    }

    const prompt = `
    You are an expert resume optimizer.
    
    RESUME:
    ${resumeText}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    TASK:
    - Identify relevant skills and experiences
    - Suggest rephrasing of work experience
    - Recommend skills to emphasize
    - Suggest a tailored professional summary
    - Identify gaps
    
    Respond ONLY with valid JSON in exactly this format:
    {
      "summary": "Concise professional summary",
      "skills": ["Skill 1", "Skill 2", "Skill 3"],
      "workExperience": [
        {
          "company": "Company Name",
          "position": "Job Title",
          "duration": "Date Range",
          "bullets": ["Accomplishment 1", "Accomplishment 2"]
        }
      ],
      "education": [
        {
          "degree": "Degree Name",
          "institution": "School Name",
          "date_range": "Year Range",
          "details": ["Detail 1", "Detail 2"]
        }
      ]
    }
    `;

      let aiResponseText = '';

      const deepSeekKey = process.env.DEEPSEEK_API_KEY;
      if (!deepSeekKey) {
        res.status(500).json({ success: false, error: 'DeepSeek API key not configured' });
        return;
      }

      aiResponseText = await getCachedOrNewAIResponse(resumeText, jobDescription, async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepSeekKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'You are an expert resume optimizer.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 1500
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepSeek API error: ${errorText}`);
        }

        const data: any = await response.json();
        if (!data.choices || !data.choices[0]?.message?.content) {
          throw new Error('DeepSeek API returned unexpected response format');
        }
        return data.choices[0].message.content;
      });

      console.log('AI raw response:', aiResponseText);

    try {
      // Remove Markdown code block markers if present
      const cleanedResponse = aiResponseText.replace(/```json|```/g, '').trim();

      // Extract JSON substring
      const jsonMatch = cleanedResponse.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      let optimized;
      try {
        optimized = JSON.parse(jsonMatch[0]);
      } catch (jsonError) {
        throw new Error('Invalid JSON format in AI response');
      }

      // Validate optimized object structure
      if (
        typeof optimized !== 'object' ||
        !optimized.summary ||
        !Array.isArray(optimized.skills) ||
        !Array.isArray(optimized.workExperience)
      ) {
        throw new Error('AI response JSON missing required fields');
      }

      const transformed = transformAIResponse(optimized, {}); // Pass original resume data if available
      res.status(200).json({ success: true, optimized: transformed });
    } catch (parseError: any) {
      console.error('AI response parsing/validation failed:', parseError);
      console.log('Using fallback optimizer...');
      const fallbackOptimized = fallbackOptimizeResume(resumeText, jobDescription);
      res.status(200).json({ success: true, optimized: fallbackOptimized });
    }
    } catch (error: any) {
      console.error('Unexpected error in /api/optimize:', error);
      res.status(500).json({ success: false, error: error.message || 'Unexpected server error' });
    }
});
/**
 * Generate a .docx resume from transformed JSON data
 */
app.post('/api/generate-docx', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;

    const officegen = require('officegen');
    const docx = officegen('docx');

    // Handle errors
    docx.on('error', (err: any) => {
      console.error('Docx generation error:', err);
    });

    // Add name as title
    const name = data.contact_info?.name || 'Professional Resume';
    const pObjTitle = docx.createP();
    pObjTitle.addText(name, { bold: true, font_size: 24 });

    // Contact info
    const contactParts = [];
    if (data.contact_info?.email) contactParts.push(`Email: ${data.contact_info.email}`);
    if (data.contact_info?.phone) contactParts.push(`Phone: ${data.contact_info.phone}`);
    if (data.contact_info?.location) contactParts.push(`Location: ${data.contact_info.location}`);
    if (contactParts.length > 0) {
      const pObjContact = docx.createP();
      pObjContact.addText(contactParts.join(' | '), { font_size: 12 });
    }

    // Summary
    if (data.summary) {
      const pObjSummaryHeader = docx.createP();
      pObjSummaryHeader.addText('Professional Summary', { bold: true, font_size: 16 });
      const pObjSummary = docx.createP();
      pObjSummary.addText(data.summary, { font_size: 12 });
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      const pObjSkillsHeader = docx.createP();
      pObjSkillsHeader.addText('Skills', { bold: true, font_size: 16 });
      const pObjSkills = docx.createP();
      pObjSkills.addText(data.skills.join(', '), { font_size: 12 });
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      const pObjExpHeader = docx.createP();
      pObjExpHeader.addText('Professional Experience', { bold: true, font_size: 16 });

      for (const job of data.experience) {
        const pObjJobTitle = docx.createP();
        pObjJobTitle.addText(`${job.title} at ${job.company}`, { bold: true, font_size: 14 });

        if (job.date_range) {
          const pObjDate = docx.createP();
          pObjDate.addText(job.date_range, { italics: true, font_size: 12 });
        }

        if (job.description && job.description.length > 0) {
          for (const bullet of job.description) {
            const pObjBullet = docx.createListOfDots();
            pObjBullet.addText(bullet, { font_size: 12 });
          }
        }
      }
    }

    // Education
    if (data.education && data.education.length > 0) {
      const pObjEduHeader = docx.createP();
      pObjEduHeader.addText('Education', { bold: true, font_size: 16 });

      for (const edu of data.education) {
        const pObjEdu = docx.createP();
        pObjEdu.addText(`${edu.degree}, ${edu.institution}`, { bold: true, font_size: 14 });

        if (edu.date_range) {
          const pObjDate = docx.createP();
          pObjDate.addText(edu.date_range, { italics: true, font_size: 12 });
        }

        if (edu.details && edu.details.length > 0) {
          for (const detail of edu.details) {
            const pObjDetail = docx.createListOfDots();
            pObjDetail.addText(detail, { font_size: 12 });
          }
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=optimized_resume.docx');

    await new Promise<void>((resolve, reject) => {
      docx.generate(res, {
        finalize: () => resolve(),
        error: (err: any) => reject(err),
      });
    });
  } catch (error: any) {
    console.error('Error generating docx:', error);
    res.status(500).json({ success: false, error: 'Failed to generate resume document' });
  }
});

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
