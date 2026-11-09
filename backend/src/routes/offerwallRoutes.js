
import express from "express";
import { handleOfferwallPostback } from "../controllers/offerwallController.js";

const router = express.Router();

// Offerwall.me server-to-server postback
router.post("/postback", handleOfferwallPostback);

export default router;
