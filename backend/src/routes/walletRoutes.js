import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { summary, transactions } from "../controllers/walletController.js";
const router = Router();
router.use(protect);
router.get("/", summary);
router.get("/transactions", transactions);
export default router;
