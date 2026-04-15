// backend/src/modules/notifications/notification.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// Get notifications for the current user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, message: true, isRead: true, readAt: true, link: true, createdAt: true },
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark a single notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const id = String(req.params.id);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const notification = await prisma.notification.findFirst({ where: { id, userId: String(userId) } });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a single notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const id = String(req.params.id);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const notification = await prisma.notification.findFirst({ where: { id, userId: String(userId) } });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });

    await prisma.notification.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all notifications as read for the current user
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
