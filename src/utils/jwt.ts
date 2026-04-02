// backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

export const generateAccessToken = (payload: object): string => {
  return jwt.sign(payload as any, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES as any });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload as any, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES as any });
};

export const verifyAccessToken = (token: string): any => {
  return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, REFRESH_SECRET);
};