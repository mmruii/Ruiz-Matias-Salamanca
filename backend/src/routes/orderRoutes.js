import { Router } from "express";
import orderController from "../controllers/OrderController.js";
import { requireAdmin } from "../middlewares/adminSession.js";

const router = Router();
router.get("/", requireAdmin, orderController.getAll);
router.post("/", orderController.create);
export default router;
