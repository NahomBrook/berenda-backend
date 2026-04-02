// backend/src/modules/ai/ai.routes.ts
import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import { sendAIMessage, clearConversation } from "./ai.controller";

const router = Router();

// AI routes: mounted at /api/ai in backend/src/app.ts

// Test endpoint (no auth required)
router.get("/test", (req, res) => {
  res.json({ message: "AI routes are working!", timestamp: new Date().toISOString() });
});

// AI chat endpoint - NO AUTH REQUIRED (allows anonymous users)
router.post("/chat", sendAIMessage);

// Clear conversation history (requires auth - optional, can be removed if needed)
router.delete("/chat/history", verifyToken, clearConversation);

export default router;