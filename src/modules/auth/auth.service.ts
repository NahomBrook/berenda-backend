// backend/src/modules/auth/auth.service.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "superlongrandomaccesssecret";
const JWT_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";

// Define proper types for Google payload
interface GoogleTokenPayload {
  aud: string;
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

export const registerUser = async (
  email: string,
  password: string,
  roleName: string = "USER",
  fullName?: string
) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const role = await prisma.role.findUnique({
    where: { name: roleName }
  });
  
  if (!role) {
    throw new Error(`Role "${roleName}" not found`);
  }
  
  const usernameBase = email.split('@')[0];
  let username = usernameBase;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${usernameBase}${suffix++}`;
  }
  
  const user = await prisma.user.create({
    data: { 
      email, 
      passwordHash: hashedPassword, 
      fullName: fullName || username,
      username,
      isVerified: true,
      roles: {
        create: {
          roleId: role.id
        }
      }
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });
  
  return user;
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });
  
  if (!user) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new Error("Invalid credentials");

  const roleNames = user.roles.map(r => r.role.name);
  
  // Fixed JWT sign - use as any to bypass strict type checking
  const payload = { 
    userId: user.id, 
    email: user.email,
    roles: roleNames,
    isAdmin: roleNames.includes("ADMIN") || roleNames.includes("SUPER_ADMIN")
  };
  
  const token = jwt.sign(payload as any, JWT_SECRET, { expiresIn: JWT_EXPIRES as any });

  return { user, token };
};

export const loginWithGoogle = async (idToken: string) => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) throw new Error("Invalid Google ID token");
    
    const payload = await response.json() as GoogleTokenPayload;

    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error("Google ID token audience mismatch");
    }

    const email: string = payload.email;
    const fullName: string = payload.name || "";
    const picture: string | undefined = payload.picture;

    if (!email) throw new Error("Google token did not contain email");

    let user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });
    
    if (!user) {
      const userRole = await prisma.role.findUnique({
        where: { name: "USER" }
      });
      
      if (!userRole) {
        throw new Error("USER role not found");
      }
      
      const randomPass = Math.random().toString(36).slice(-12);
      const hashed = await bcrypt.hash(randomPass, 10);
      const usernameBase = email.split("@")[0];
      let username = usernameBase;
      let suffix = 1;
      
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${usernameBase}${suffix++}`;
      }

      user = await prisma.user.create({
        data: {
          email,
          fullName: fullName || email.split("@")[0],
          username,
          passwordHash: hashed,
          profileImageUrl: picture,
          isVerified: true,
          roles: {
            create: {
              roleId: userRole.id
            }
          }
        },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });
    }
    
    const roleNames = user.roles.map(r => r.role.name);
    
    const payload2 = { 
      userId: user.id, 
      email: user.email,
      roles: roleNames,
      isAdmin: roleNames.includes("ADMIN") || roleNames.includes("SUPER_ADMIN")
    };
    
    const token = jwt.sign(payload2 as any, JWT_SECRET, { expiresIn: JWT_EXPIRES as any });
    
    return { user, token };
  } catch (error: any) {
    console.error("Google login error:", error);
    throw new Error(error.message || "Google authentication failed");
  }
};