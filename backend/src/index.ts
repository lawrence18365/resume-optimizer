import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';

dotenv.config();

const app = express();
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
    const provider = req.query.provider || 'openai';

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

Respond ONLY with valid JSON in this format:
{
  "summary": "...",
  "skills": ["...", "..."],
  "workExperience": [
    {
      "company": "...",
      "position": "...",
      "duration": "...",
      "bullets": ["...", "..."]
    }
  ],
  "education": ["..."],
  "recommendations": "...",
  "errors": []
}
`;

      let aiResponseText = '';

      if (provider === 'deepseek') {
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

      } else {
        const openaiKey = process.env.AI_API_KEY;
        if (!openaiKey) {
          res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
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
          throw new Error(`OpenAI API error: ${errorText}`);
        }

        const data: any = await response.json();
        if (!data.choices || !data.choices[0]?.message?.content) {
          throw new Error('OpenAI API returned unexpected response format');
        }
        aiResponseText = data.choices[0].message.content;
      }

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

      res.status(200).json({ success: true, optimized });
    } catch (parseError: any) {
      console.error('AI response parsing/validation failed:', parseError);
      res.status(500).json({ success: false, error: 'Failed to parse or validate AI response', details: parseError.message });
    }
    } catch (error: any) {
      console.error('Unexpected error in /api/optimize:', error);
      res.status(500).json({ success: false, error: error.message || 'Unexpected server error' });
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
