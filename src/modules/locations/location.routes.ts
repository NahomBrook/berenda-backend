// backend/src/modules/locations/location.routes.ts
import { Router } from "express";
import { searchLocations, getLocationByCoordinates } from "./location.controller";

const router = Router();

// GET /api/locations/search?q=query
router.get("/search", searchLocations);

// GET /api/locations/reverse?lat=...&lng=...
router.get("/reverse", getLocationByCoordinates);

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Location routes are working!" });
});

export default router;