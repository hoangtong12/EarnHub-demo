import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = new Set([
  "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
  "http://localhost:5176", "http://localhost:5177", "http://localhost:5178",
  "http://localhost:5179", "http://localhost:5180",
  "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175",
  "http://127.0.0.1:5176", "http://127.0.0.1:5177", "http://127.0.0.1:5178",
  "http://127.0.0.1:5179", "http://127.0.0.1:5180"
]);
if (process.env.CLIENT_URL) allowedOrigins.add(process.env.CLIENT_URL.replace(/\/+$/, ""));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ""))) return callback(null, true);
    return callback(new Error(`CORS origin không được phép: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

app.get("/", (req, res) => res.json({ name: "EarnHub Pro API", status: "running" }));
app.get("/api/health", (req, res) => res.json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
}));

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ message: "API không tồn tại", path: req.originalUrl }));
app.use((err, req, res, next) => {
  console.error("API error:", err);
  if (err.message?.startsWith("CORS origin")) return res.status(403).json({ message: err.message });
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "development" ? err.message : "Lỗi máy chủ"
  });
});

const start = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error("Thiếu MONGODB_URI trong backend/.env");
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) throw new Error("JWT_SECRET cần tối thiểu 24 ký tự");
    await connectDB();
    const port = Number(process.env.PORT || 5000);
    app.listen(port, "0.0.0.0", () => {
      console.log(`EarnHub Pro API: http://localhost:${port}`);
      console.log(`Allowed frontend: ${process.env.CLIENT_URL || "localhost:5173-5180"}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
};
start();
