// backend/src/server.ts
import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI test: http://localhost:${PORT}/api/ai/test`);
});

export default app;