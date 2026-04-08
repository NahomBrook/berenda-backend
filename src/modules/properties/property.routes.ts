// backend/src/modules/properties/property.routes.ts
import { Router } from "express";
import * as propertyController from "./property.controller";
import { verifyToken, isAdmin } from "../../middlewares/auth.middleware";
import upload from "../../middlewares/upload";
import availabilityRouter from "./property-availability.routes";

const router = Router();

// ── Public routes (no authentication required) ──────────────────────────────
router.get("/", propertyController.getProperties);
router.get("/search", propertyController.searchProperties);
router.get("/location/:location", propertyController.getPropertiesByLocation);
// NOTE: /user/properties MUST come before /:id so Express doesn't treat
//       "user" as the :id segment. It is protected, so we inline verifyToken.
router.get("/user/properties", verifyToken, propertyController.getUserProperties);
router.get("/:id", propertyController.getPropertyById);

// Availability check (nested under /:id) – public
router.use("/:id", availabilityRouter);

// ── Protected routes (authentication required) ───────────────────────────────
router.use(verifyToken);

// Create property
router.post("/", propertyController.createProperty);

// Update / delete property
router.patch("/:id", propertyController.updateProperty);
router.delete("/:id", propertyController.deleteProperty);

// Upload property images (max 10)
router.post("/:propertyId/images", upload.array("images", 10), propertyController.uploadPropertyImages);

// Update property approval status (admin should call admin routes instead,
// but this route is kept for host-side availability toggling)
router.patch("/:id/status", isAdmin, propertyController.updatePropertyStatus);

export default router;
