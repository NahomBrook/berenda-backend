import { Router } from "express";
import { searchLocations } from "./location.controller";

const router = Router();

// GET /api/locations/search?q=query
router.get("/search", searchLocations);

// Optional: Add a test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Location routes are working!" });
});

export default router;
