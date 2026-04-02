import express from "express";
import * as AuthController from "../modules/auth/auth.controller";

const router = express.Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google", AuthController.googleLogin);

export default router;