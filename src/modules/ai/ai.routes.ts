// backend/src/modules/ai/ai.routes.ts
import { Router } from "express";
import { verifyToken, optionalAuth } from "../../middlewares/auth.middleware";
import { sendAIMessage, clearConversation } from "./ai.controller";

const router = Router();

// AI routes: mounted at /api/ai in backend/src/app.ts

// Test endpoint (no auth required)
router.get("/test", (_req, res) => {
  res.json({ message: "AI routes are working!", timestamp: new Date().toISOString() });
});

// AI chat endpoint - optional auth (personalizes response if logged in)
router.post("/chat", optionalAuth, sendAIMessage);

// Clear conversation history (requires auth - optional, can be removed if needed)
router.delete("/chat/history", verifyToken, clearConversation);

export default router;