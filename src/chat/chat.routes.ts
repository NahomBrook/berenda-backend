// backend/src/modules/chat/chat.routes.ts
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import {
  getChats,
  getChatById,
  createChat,
  getMessages,
  sendMessage,
  getUnreadCount,
  sendAIMessage,
} from "./chat.controller";

const router = Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working!", timestamp: new Date().toISOString() });
});

// All chat routes require authentication
router.use(verifyToken);

// Chat endpoints
router.get("/", getChats);
router.get("/unread", getUnreadCount);
router.post("/", createChat);
router.get("/:chatId", getChatById);
router.get("/:chatId/messages", getMessages);
router.post("/:chatId/messages", sendMessage);
router.post("/:chatId/ai", sendAIMessage);

export default router;