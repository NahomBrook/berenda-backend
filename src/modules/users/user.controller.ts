// backend/src/modules/users/user.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        isVerified: true,
        createdAt: true,
        profileImageUrl: true,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "User list fetched successfully",
      data: users,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      timestamp: new Date().toISOString(),
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { fullName, phone } = req.body;
    const profileImageUrl = req.file
      ? req.file.path || (req.file as any).secure_url || `/uploads/${req.file.filename}`
      : undefined;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

export const getUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: true,
      },
    });

    const defaultSettings = {
      emailNotifications: {
        newMessages: true,
        bookingConfirmations: true,
        promotionalOffers: false,
      },
      privacy: {
        profilePublic: true,
        showEmail: false,
      },
      language: "en",
      region: "US",
    };

    res.json({
      success: true,
      data: user?.settings || defaultSettings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings",
    });
  }
};

export const updateUserLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ success: false, message: "latitude and longitude must be numbers" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastLocationAt: new Date(),
      },
    });

    res.json({ success: true, message: "Location updated" });
  } catch (error) {
    console.error("Error updating user location:", error);
    res.status(500).json({ success: false, message: "Failed to update location" });
  }
};

export const updateUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const settings = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        settings: settings,
      },
    });

    res.json({
      success: true,
      data: updatedUser.settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update settings",
    });
  }
};