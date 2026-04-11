// backend/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// Use the same secret that was used to sign the tokens (JWT_ACCESS_SECRET takes priority)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "superlongrandomaccesssecret";

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Format should be: Bearer <token>"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Fetch user from database with roles
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Attach user info to request
    (req as any).user = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map(r => r.role.name),
      isAdmin: user.roles.some(r => r.role.name === "ADMIN" || r.role.name === "admin"),
      isSuperAdmin: user.roles.some(r => r.role.name === "SUPER_ADMIN" || r.role.name === "super_admin"),
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

/** Attaches user to req if a valid token is present, but never rejects anonymous requests. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, fullName: true, email: true },
    });
    if (user) {
      (req as any).user = { userId: user.id, fullName: user.fullName, email: user.email };
    }
  } catch (_) {}
  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied: Admin privileges required"
    });
  }
};

export const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (user.isSuperAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied: Super Admin privileges required"
    });
  }
};
