// backend/src/modules/favorites/favorite.routes.ts
import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import { getFavorites, addFavorite, removeFavorite } from "./favorite.controller";

const router = Router();

router.use(verifyToken);

router.get("/", getFavorites);
router.post("/", addFavorite);
router.delete("/:propertyId", removeFavorite);

export default router;