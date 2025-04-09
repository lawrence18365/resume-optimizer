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
    res.json({ success: true, text });
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
      aiResponseText = data.choices[0].message.content;

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
      res.status(500).json({ success: false, error: 'Failed to parse or validate AI response', details: parseError.message });
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
