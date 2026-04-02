import { Router } from "express";
import { checkPropertyEligibility } from "./property-availability.controller";

const router = Router({ mergeParams: true });

router.post("/check-availability", checkPropertyEligibility);

export default router;