import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../../src/config/cloudinary";
import path from "path";

// Use memory storage for Vercel (no disk writes)
const memoryStorage = multer.memoryStorage();

// Configure Cloudinary storage if available
let storage: any = memoryStorage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  try {
    const cloudinaryStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: async (req: any, file: any) => {
        return {
          folder: "berenda_properties",
          format: "jpg",
          public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
        };
      },
    });
    storage = cloudinaryStorage;
    console.log("✅ Cloudinary storage configured");
  } catch (error) {
    console.error("❌ Failed to configure Cloudinary storage:", error);
    storage = memoryStorage;
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export default upload;
