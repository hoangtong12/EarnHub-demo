
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
import offerwallRoutes from "./routes/offerwallRoutes.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// ==========================================
// SECURITY HEADERS
// ==========================================
app.use(helmet());

// ==========================================
// CORS CONFIGURATION
// ==========================================
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  "http://localhost:5180",

  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
  "http://127.0.0.1:5178",
  "http://127.0.0.1:5179",
  "http://127.0.0.1:5180"
]);

// Add deployed frontend URLs from environment
if (process.env.CLIENT_URL) {
  const clientUrls = process.env.CLIENT_URL.split(",");

  for (const url of clientUrls) {
    const cleanUrl = url.trim().replace(/\/+$/, "");

    if (cleanUrl) {
      allowedOrigins.add(cleanUrl);
    }
  }
}

// CORS middleware
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin (server-to-server, Postback, Postman)
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.has(cleanOrigin)) {
        return callback(null, true);
      }

      console.error("CORS blocked:", origin);

      return callback(
        new Error("CORS origin không được phép: " + origin)
      );
    },

    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204
  })
);

// ==========================================
// REQUEST BODY PARSING
// ==========================================
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// ==========================================
// API RATE LIMIT
// ==========================================
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau."
    }
  })
);

// ==========================================
// ROOT API
// ==========================================
app.get("/", (req, res) => {
  res.json({
    name: "EarnHub Pro API",
    status: "running",
    message: "EarnHub Pro backend is working"
  });
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// API ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminRoutes);

// Offerwall.me Postback
app.use("/api/offerwall", offerwallRoutes);

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    message: "Không tìm thấy API này"
  });
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.message?.startsWith("CORS origin")) {
    return res.status(403).json({
      message: "Nguồn truy cập không được phép"
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : statusCode >= 500
          ? "Lỗi máy chủ"
          : err.message
  });
});

// ==========================================
// START SERVER
// ==========================================
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Thiếu MONGODB_URI trong file .env");
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
      throw new Error("JWT_SECRET phải có ít nhất 24 ký tự");
    }

    // Connect MongoDB
    await connectDB();

    const PORT = Number(process.env.PORT) || 5000;

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("--------------------------------");
      console.log("EarnHub Pro API is running");
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Offerwall Postback: http://localhost:${PORT}/api/offerwall/postback`);
      console.log("--------------------------------");
    });

    server.on("error", (error) => {
      console.error("Server startup error:", error);
      process.exit(1);
    });

  } catch (error) {
    console.error("Cannot start EarnHub Pro:", error.message);
    process.exit(1);
  }
}

startServer();
