// src/modules/auth/auth.repository.ts
import prisma from "../../config/prisma";
import { User } from "@prisma/client";
import bcrypt from "bcrypt";

// CREATE USER
export const createUser = async (data: {
  email: string;
  fullName: string;
  password: string;
  username?: string;
}): Promise<User> => {
  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Generate username if not provided
  const username =
    data.username ?? data.email.split("@")[0] + "_" + Math.floor(Math.random() * 10000);

  // Create user in DB
  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      username,
      passwordHash,
    },
  });
};

// VALIDATE USER
export const validateUser = async (email: string, password: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
};