import app from "./app";

// Render automatically sets process.env.PORT
const PORT = process.env.PORT || 5000;

// Explicitly bind to '0.0.0.0' to ensure Render can detect the port
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/api/health`);
});

export default app;