// backend/src/routes/location.routes.ts
import { Router } from "express";
import { searchLocations } from "../modules/locations/location.controller";

const router = Router();

router.get("/search", searchLocations);

export default router;