
import { Router } from "express";

import { protect } from "../middleware/auth.js";

import {
  handleOfferwallPostback
} from "../controllers/offerwallController.js";

import {
  listOfferwallTasks,
  listOfferwallOffers,
  listOfferwallSurveys
} from "../controllers/offerwallFeedController.js";

const router = Router();

// Postback từ Offerwall.me: không yêu cầu đăng nhập thành viên
router.post("/postback", handleOfferwallPostback);

// Các API danh sách: yêu cầu thành viên đăng nhập
router.get("/tasks", protect, listOfferwallTasks);
router.get("/offers", protect, listOfferwallOffers);
router.get("/surveys", protect, listOfferwallSurveys);

export default router;
