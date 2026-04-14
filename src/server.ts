import http from "http";
import { execSync } from "child_process";
import app from "./app";

// Run DB migrations before starting the server.
// This guarantees every Render deploy applies pending migrations without
// requiring any dashboard changes to the build command.
try {
  console.log("🔄 Running database migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("✅ Migrations complete");
} catch (err) {
  // Log but don't crash — the server can still start if the DB is already
  // up-to-date and the error is transient.
  console.error("⚠️  Migration step failed (non-fatal):", err);
}

// Render automatically sets process.env.PORT
const PORT = process.env.PORT || 5000;

// Explicitly bind to '0.0.0.0' to ensure Render can detect the port
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/api/health`);

  // Keep-alive: ping our own health endpoint every 14 minutes so Render free
  // tier doesn't spin down the instance (it sleeps after 15 min of inactivity)
  const SELF_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/api/health`
    : null;

  if (SELF_URL) {
    setInterval(() => {
      http.get(SELF_URL, (res) => {
        res.resume(); // drain response body
      }).on('error', () => {
        // Silently ignore — if the server is restarting it will ping again
      });
    }, 14 * 60 * 1000); // every 14 minutes
    console.log(`🏓 Keep-alive pinging ${SELF_URL} every 14 minutes`);
  }
});

export default app;