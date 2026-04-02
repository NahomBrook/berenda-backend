// backend/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// Use the same JWT_SECRET that was used to sign the tokens
const JWT_SECRET = process.env.JWT_SECRET || "superlongrandomaccesssecret";

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log("=== Auth Middleware Debug ===");
  console.log("JWT_SECRET used:", JWT_SECRET ? "Secret is set" : "Secret is MISSING");
  
  const authHeader = req.headers.authorization;
  console.log("Auth Header:", authHeader ? "Present" : "Missing");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No valid Bearer token found");
    return res.status(401).json({ 
      success: false, 
      message: "No token provided. Format should be: Bearer <token>" 
    });
  }

  const token = authHeader.split(" ")[1];
  console.log("Token received (first 20 chars):", token.substring(0, 20) + "...");

  try {
    console.log("Attempting to verify token...");
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log("Token verified successfully!");
    
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
      console.log("User not found in database");
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
    
    console.log("User roles:", (req as any).user.roles);
    console.log("Is Admin:", (req as any).user.isAdmin);
    
    next();
  } catch (err: any) {
    console.error("JWT Verification Error Details:");
    console.error("- Error name:", err.name);
    console.error("- Error message:", err.message);
    
    return res.status(401).json({ 
      success: false,
      message: "Invalid or expired token",
      error: err.message 
    });
  }
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