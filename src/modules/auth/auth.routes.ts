// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { register, login, googleLogin } from "./auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);

export default router;
