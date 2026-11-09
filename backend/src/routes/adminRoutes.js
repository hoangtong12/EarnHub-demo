import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  dashboard, users, adjustPoints, resetUserPassword, toggleUser,
  listWithdrawals, updateWithdrawal, createTask, toggleTask
} from "../controllers/adminController.js";

const router = Router();
router.use(protect, adminOnly);
router.get("/dashboard", dashboard);
router.get("/users", users);
router.post("/users/:id/points", adjustPoints);
router.patch("/users/:id/password", resetUserPassword);
router.patch("/users/:id/status", toggleUser);
router.get("/withdrawals", listWithdrawals);
router.patch("/withdrawals/:id", updateWithdrawal);
router.post("/tasks", createTask);
router.patch("/tasks/:id/toggle", toggleTask);
export default router;
