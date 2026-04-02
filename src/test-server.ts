import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/api/ai/test', (req, res) => {
  res.json({ message: 'AI routes are working!', timestamp: new Date().toISOString() });
});

app.get('/api/properties', (req, res) => {
  res.json({ success: true, data: [], message: 'Test response' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login endpoint reached' });
});

export default app;
