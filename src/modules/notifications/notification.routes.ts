// backend/src/modules/notifications/notification.routes.ts
import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import * as notificationController from "./notification.controller";

const router = Router();

router.use(verifyToken);

router.get("/", notificationController.getNotifications);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

export default router;
