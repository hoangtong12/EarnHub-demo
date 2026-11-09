import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { makeToken, publicUser } from "../utils/token.js";

export async function register(req, res) {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ message: "Username 3-24 ký tự, chỉ gồm chữ, số và dấu gạch dưới" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Mật khẩu cần ít nhất 8 ký tự" });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ message: "Username hoặc email đã được sử dụng" });

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 12) });
    await Wallet.create({ user: user._id });
    return res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Username hoặc email đã tồn tại" });
    throw error;
  }
}

export async function login(req, res) {
  const identity = String(req.body.identity || "").trim();
  const password = String(req.body.password || "");
  const user = await User.findOne({
    $or: [{ email: identity.toLowerCase() }, { username: identity }]
  }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Tên đăng nhập/email hoặc mật khẩu không đúng" });
  }
  if (user.status !== "active") return res.status(403).json({ message: "Tài khoản đã bị khóa" });

  return res.json({ token: makeToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
