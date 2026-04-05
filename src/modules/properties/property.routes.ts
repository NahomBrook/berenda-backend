// backend/src/modules/properties/property.routes.ts
import { Router } from "express";
import * as propertyController from "./property.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import upload from "../../middlewares/upload";

const router = Router();

// Public routes (no authentication required)
router.get("/", propertyController.getProperties);
router.get("/search", propertyController.searchProperties);
router.get("/location/:location", propertyController.getPropertiesByLocation);
router.get("/:id", propertyController.getPropertyById);

// Protected routes (authentication required)
router.use(verifyToken); // All routes below this line require authentication

// User's own properties
router.get("/user/properties", propertyController.getUserProperties);

// Create property
router.post("/", propertyController.createProperty);

// Update property
router.patch("/:id", propertyController.updateProperty);

// Delete property
router.delete("/:id", propertyController.deleteProperty);

// Upload property images
router.post("/:propertyId/images", upload.array("images", 10), propertyController.uploadPropertyImages);

// Update property status (admin only - you may want to add admin check middleware)
router.patch("/:id/status", propertyController.updatePropertyStatus);

export default router;