
import { Router } from "express";
import { protect } from "../middleware/auth.js";

import {
  createWithdrawal,
  myWithdrawals,
  createLegacyWithdrawal
} from "../controllers/withdrawalController.js";

const router = Router();

router.use(protect);

// Lịch sử rút tiền
router.get("/", myWithdrawals);

// Rút USD mới
router.post("/", createWithdrawal);

// API rút điểm cũ, giữ tương thích
router.post("/legacy", createLegacyWithdrawal);

export default router;
