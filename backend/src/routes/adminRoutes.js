
import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";

import {
  dashboard,
  users,
  adjustPoints,
  adjustUsd,
  resetUserPassword,
  toggleUser,
  listWithdrawals,
  updateWithdrawal,
  createTask,
  toggleTask,
  updateExchangeRate,
  revenueSummary,
  listRevenue
} from "../controllers/adminController.js";

const router = Router();

router.use(protect, adminOnly);

// Tổng quan Admin
router.get("/dashboard", dashboard);

// Quản lý thành viên
router.get("/users", users);
router.post("/users/:id/points", adjustPoints);
router.post("/users/:id/usd", adjustUsd);
router.patch("/users/:id/password", resetUserPassword);
router.patch("/users/:id/status", toggleUser);

// Quản lý rút tiền
router.get("/withdrawals", listWithdrawals);
router.patch("/withdrawals/:id", updateWithdrawal);

// Quản lý tỷ giá
router.patch("/exchange-rate", updateExchangeRate);

// Quản lý doanh thu
router.get("/revenue", revenueSummary);
router.get("/revenue/transactions", listRevenue);

// Quản lý nhiệm vụ
router.post("/tasks", createTask);
router.patch("/tasks/:id/toggle", toggleTask);

export default router;
