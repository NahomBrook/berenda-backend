import express from "express";
import { initializePayment, verifyPayment, chapaWebhook } from "./payments.controller";
import { verifyToken } from "../../middlewares/auth.middleware";

const router = express.Router();

router.post("/initialize", verifyToken, initializePayment);
router.get("/verify/:txRef", verifyToken, verifyPayment);
// Webhook should be public facing to accept requests from Chapa's servers securely
router.post("/webhook", express.raw({ type: 'application/json' }), chapaWebhook);

export default router;
