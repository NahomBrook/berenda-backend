// backend/src/modules/properties/property.routes.ts
import { Router } from "express";
import { 
  createProperty, 
  getProperties, 
  getPropertyById, 
  updateProperty, 
  deleteProperty,
  uploadPropertyImages,
  searchProperties
} from "./property.controller";
import { checkPropertyEligibility } from "./property-availability.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import { upload } from "../../config/cloudinary";

const router = Router();

// ========== IMPORTANT: Specific routes FIRST, then parameterized routes ==========

// Test route - must come BEFORE /:id
router.get("/test", (req, res) => {
  res.json({ message: "Property routes are working!", timestamp: new Date().toISOString() });
});

// Search route - must come BEFORE /:id
router.get("/search", searchProperties);

// Public routes with parameters - these come after specific routes
router.get("/", getProperties);
router.get("/:id", getPropertyById);

// Availability check - this is a POST route, so it won't conflict with GET /:id
router.post("/:id/check-availability", checkPropertyEligibility);

// Protected routes
router.post("/", verifyToken, createProperty);
router.patch("/:id", verifyToken, updateProperty);
router.delete("/:id", verifyToken, deleteProperty);

// Multi-image upload route
router.post("/:propertyId/images", verifyToken, upload.array("images", 5), uploadPropertyImages);

export default router;