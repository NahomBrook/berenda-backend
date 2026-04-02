import { Router } from "express";
import * as UsersController from "../controllers/user.controller"; 

const router = Router();

router.get("/", UsersController.listUsers); // ✅ must be a function

export default router;