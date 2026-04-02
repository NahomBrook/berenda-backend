// backend/src/app.ts
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import propertyRoutes from "./modules/properties/property.routes"; 
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import bookingRoutes from "./modules/bookings/booking.routes";
import adminRoutes from "./modules/admin/admin.routes";
import chatRoutes from "./modules/chat/chat.routes";
import locationRoutes from "./modules/locations/location.routes"; 
import aiRoutes from "./modules/ai/ai.routes";
import paymentRoutes from "./modules/payments/payments.routes";

const app = express();

// Dynamic CORS origins - allows any Vercel deployment URL
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://berenda-platform.vercel.app',
  'https://berenda-plc.vercel.app',
  'https://berenda-41a2.vercel.app',
  /\.vercel\.app$/,
];

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return pattern === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway for now, but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files for uploads - wrapped in try/catch for Vercel
try {
  //app.use("/uploads", express.static("uploads"));
} catch (error) {
  console.log("Uploads directory not available in serverless environment");
}

// ==================== PUBLIC ROUTES (No Auth) ====================
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get("/api/ai/test", (req: Request, res: Response) => {
  res.json({
    message: "AI routes are working!",
    timestamp: new Date().toISOString()
  });
});

// ==================== API ROUTES ====================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/payments", paymentRoutes);

// ==================== LEGACY HEALTH CHECK ====================
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== 404 HANDLER ====================
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false,
    status: 404, 
    message: `Route ${req.method} ${req.url} not found`, 
    timestamp: new Date().toISOString() 
  });
});

// ==================== CENTRALIZED ERROR HANDLER ====================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack || err);
  
  // Always return JSON, never HTML
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Invalid or missing authentication token',
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      status: 400,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    status: err.status || 500,
    message: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;