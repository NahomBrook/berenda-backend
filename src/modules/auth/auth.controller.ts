// backend/src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import * as AuthService from "./auth.service";
import { sendResponse } from "../../utils/response";

// Gmail-only validation for NEW registrations.
// Login intentionally skips this so existing admin/system accounts can log in.
const isGmailAddress = (email: string) =>
  /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(email.trim());

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!isGmailAddress(email)) {
      return res.status(400).json({
        success: false,
        message: "Only Gmail addresses (@gmail.com) are accepted for registration",
      });
    }

    const user = await AuthService.registerUser(email, password, role || "USER", fullName);

    sendResponse(res, 201, "User registered", {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      username: user.username,
      isVerified: user.isVerified,
      roles: user.roles?.map((r) => ({ name: r.role.name })) || [],
    });
  } catch (err: any) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // No Gmail restriction on login — system/admin accounts may use other domains.
    const { user, token } = await AuthService.loginUser(email, password);

    sendResponse(res, 200, "Login successful", {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: user.roles?.map((r) => ({ name: r.role.name })) || [],
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }

    const { user, token } = await AuthService.loginWithGoogle(idToken);

    sendResponse(res, 200, "Login successful", {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: user.roles?.map((r) => ({ name: r.role.name })) || [],
      },
    });
  } catch (err: any) {
    next(err);
  }
};
