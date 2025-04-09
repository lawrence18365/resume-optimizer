import { useState } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [parsedText, setParsedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [optimizedResult, setOptimizedResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a resume file');
      return;
    }
    setLoading(true);
    setError('');
    setParsedText('');
    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setParsedText(data.text);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during upload');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOptimize = async () => {
    if (!parsedText || !jobDescription) {
      setError('Please upload a resume and enter a job description');
      return;
    }
    setLoading(true);
    setError('');
    setOptimizedResult(null);
    try {
      const response = await fetch('http://localhost:5000/api/optimize?provider=deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeText: parsedText,
          jobDescription,
        }),
      });
  
      const data = await response.json();
      console.log('Backend optimize response:', data);
  
      if (data.success) {
        setOptimizedResult(data.optimized);
        setError('');
      } else {
        setOptimizedResult(null);
        setError(data.error || 'Optimization failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during optimization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Resume Optimizer</h1>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">Upload Resume (DOCX):</label>
        <input type="file" accept=".docx" onChange={handleFileChange} />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-semibold">Job Description:</label>
        <textarea
          className="w-full border p-2"
          rows={6}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description here"
        />
      </div>

      <button
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        onClick={handleUpload}
        disabled={loading}
      >
        {loading ? 'Uploading...' : 'Upload and Parse'}
      </button>

      <button
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-4"
        onClick={handleOptimize}
        disabled={loading || !parsedText || !jobDescription}
      >
        {loading ? 'Optimizing...' : 'Optimize with AI'}
      </button>

      {error && (
        <div className="mt-4 text-red-500">
          <p>Error: {error}</p>
        </div>
      )}

      {parsedText && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Parsed Resume Text:</h2>
          <pre className="whitespace-pre-wrap bg-gray-100 p-2 border">{parsedText}</pre>
        </div>
      )}

      {optimizedResult ? (
        <div className="mt-6 space-y-4">
          <h2 className="text-2xl font-bold text-green-600">AI Optimized Resume</h2>

          <div>
            <h3 className="font-semibold">Summary</h3>
            <p>{optimizedResult.summary}</p>
          </div>

          <div>
            <h3 className="font-semibold">Skills</h3>
            <ul className="list-disc list-inside">
              {optimizedResult.skills.map((skill: string, idx: number) => (
                <li key={idx}>{skill}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Work Experience</h3>
            {optimizedResult.workExperience.map((job: any, idx: number) => (
              <div key={idx} className="border p-2 mb-2 rounded">
                <p className="font-semibold">{job.position} at {job.company}</p>
                <p className="italic">{job.duration}</p>
                <ul className="list-disc list-inside">
                  {job.bullets.map((bullet: string, bidx: number) => (
                    <li key={bidx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {optimizedResult.recommendations && (
            <div>
              <h3 className="font-semibold">Recommendations</h3>
              <p>{optimizedResult.recommendations}</p>
            </div>
          )}

          {optimizedResult.errors && optimizedResult.errors.length > 0 && (
            <div className="mt-4 text-red-500">
              <h3 className="font-semibold">AI Reported Errors</h3>
              <pre>{JSON.stringify(optimizedResult.errors, null, 2)}</pre>
            </div>
          )}

          {optimizedResult.errors && optimizedResult.errors.length === 0 && (
            <div className="mt-4 text-green-600 font-semibold">
              <p>AI optimization completed successfully with no reported errors.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">No optimized result yet or an error occurred.</h2>
        </div>
      )}
    </div>
  );
}

export default App;
