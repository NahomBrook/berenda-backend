// backend/src/modules/users/user.routes.ts
import { Router } from "express";
import * as UsersController from "./user.controller";
import { verifyToken } from "../../middlewares/auth.middleware";
import upload from "../../middlewares/upload";

const router = Router();

// Specific routes must come BEFORE generic routes
router.get("/profile", verifyToken, UsersController.getProfile);

router.put(
  "/profile",
  verifyToken,
  upload.single("avatar"),
  UsersController.updateProfile
);

// Generic route at the end
router.get("/", UsersController.listUsers);

export default router;