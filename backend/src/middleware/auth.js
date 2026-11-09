import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Vui lòng đăng nhập" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Tài khoản không tồn tại" });
    if (user.status !== "active") return res.status(403).json({ message: "Tài khoản đã bị khóa" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc không hợp lệ" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Bạn không có quyền quản trị" });
  }
  next();
}
