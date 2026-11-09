import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { listTasks } from "../controllers/taskController.js";
const router = Router();
router.use(protect);
router.get("/", listTasks);
export default router;
