
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { makeToken, publicUser } from "../utils/token.js";

export async function register(req, res) {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    // Kiểm tra username
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({
        message: "Username 3-24 ký tự, chỉ gồm chữ, số và dấu gạch dưới"
      });
    }

    // Kiểm tra email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Email không hợp lệ"
      });
    }

    // Kiểm tra mật khẩu
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Mật khẩu cần từ 8 đến 72 ký tự"
      });
    }

    // Kiểm tra tài khoản đã tồn tại
    const exists = await User.findOne({
      $or: [
        { username },
        { email }
      ]
    });

    if (exists) {
      return res.status(409).json({
        message: "Username hoặc email đã được sử dụng"
      });
    }

    // Tạo tài khoản
    const user = await User.create({
      username,
      email,
      password: await bcrypt.hash(password, 12)
    });

    // Tạo ví cho thành viên mới
    try {
      await Wallet.create({
        user: user._id,
        points: 0,
        pendingPoints: 0,
        usdBalance: 0,
        pendingUsd: 0
      });
    } catch (walletError) {
      // Không để lại tài khoản không có ví nếu tạo ví thất bại
      await User.deleteOne({ _id: user._id });
      throw walletError;
    }

    return res.status(201).json({
      message: "Đăng ký thành công",
      token: makeToken(user),
      user: publicUser(user)
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Username hoặc email đã tồn tại"
      });
    }

    throw error;
  }
}

// ==============================
// ĐĂNG NHẬP
// ==============================

export async function login(req, res) {
  const identity = String(req.body.identity || "").trim();
  const password = String(req.body.password || "");

  if (!identity || !password) {
    return res.status(400).json({
      message: "Vui lòng nhập tài khoản và mật khẩu"
    });
  }

  const user = await User.findOne({
    $or: [
      { email: identity.toLowerCase() },
      { username: identity }
    ]
  }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({
      message: "Tên đăng nhập/email hoặc mật khẩu không đúng"
    });
  }

  if (user.status !== "active") {
    return res.status(403).json({
      message: "Tài khoản đã bị khóa"
    });
  }

  return res.json({
    message: "Đăng nhập thành công",
    token: makeToken(user),
    user: publicUser(user)
  });
}

// ==============================
// THÔNG TIN TÀI KHOẢN HIỆN TẠI
// ==============================

export async function me(req, res) {
  return res.json({
    user: publicUser(req.user)
  });
}
