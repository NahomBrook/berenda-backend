import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import {
  getChats,
  getChatById,
  createChat,
  getMessages,
  sendMessage,
  getUnreadCount,
} from "./chat.controller";

const router = Router();

// Test endpoint to verify route is working (no auth required)
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working!", timestamp: new Date().toISOString() });
});

// All chat routes require authentication
router.use(verifyToken);

router.get("/", getChats);
router.get("/unread", getUnreadCount);
router.post("/", createChat);
router.get("/:chatId", getChatById);
router.get("/:chatId/messages", getMessages);
router.post("/:chatId/messages", sendMessage);

export default router;
