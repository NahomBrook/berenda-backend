// backend/src/modules/users/user.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// Example controller for listing users
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

// Get logged-in user profile
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

// Update profile + avatar
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { fullName, phone, location } = req.body;

    const profileImageUrl = req.file
      ? req.file.path || (req.file as any).secure_url || `/uploads/${req.file.filename}`
      : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName || undefined,
        phone: phone || undefined,
        ...(profileImageUrl && { profileImageUrl }),
      },
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