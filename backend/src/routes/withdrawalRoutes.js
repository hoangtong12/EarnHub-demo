import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { createWithdrawal, myWithdrawals } from "../controllers/withdrawalController.js";
const router = Router();
router.use(protect);
router.get("/", myWithdrawals);
router.post("/", createWithdrawal);
export default router;
