import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage using Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "berenda_properties",
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  } as any,
});

// Multer upload middleware
export const upload = multer({ storage });

// Export cloudinary instance for direct server uploads if needed
export default cloudinary;