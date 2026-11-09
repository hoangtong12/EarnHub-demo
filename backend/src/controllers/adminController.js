
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Task from "../models/Task.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction from "../models/Transaction.js";
import Revenue from "../models/Revenue.js";
import ExchangeRate from "../models/ExchangeRate.js";

import { publicUser } from "../utils/token.js";

// Làm tròn USD đến 2 chữ số thập phân
function roundUsd(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Tạo lỗi HTTP
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ==============================
// ADMIN DASHBOARD
// ==============================

export async function dashboard(req, res) {
  const [
    members,
    pendingWithdrawals,
    tasks,
    wallets,
    revenue
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Withdrawal.countDocuments({ status: "pending" }),
    Task.countDocuments(),
    Wallet.find().select("points usdBalance pendingUsd"),
    Revenue.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: null,
          grossUsd: { $sum: "$grossUsd" },
          memberUsd: { $sum: "$memberUsd" },
          adminUsd: { $sum: "$adminUsd" }
        }
      }
    ])
  ]);

  const totalPoints = wallets.reduce(
    (sum, wallet) => sum + (wallet.points || 0),
    0
  );

  const totalUsd = roundUsd(
    wallets.reduce(
      (sum, wallet) => sum + (wallet.usdBalance || 0),
      0
    )
  );

  const totalPendingUsd = roundUsd(
    wallets.reduce(
      (sum, wallet) => sum + (wallet.pendingUsd || 0),
      0
    )
  );

  const revenueData = revenue[0] || {
    grossUsd: 0,
    memberUsd: 0,
    adminUsd: 0
  };

  const exchangeRate = await ExchangeRate.findOne({
    currency: "USD"
  });

  const pointsRate = Number(
    process.env.POINTS_PER_VND || 10
  );

  res.json({
    members,
    pendingWithdrawals,
    tasks,

    // Dữ liệu điểm cũ
    totalPoints,
    totalBalanceVND: Math.floor(totalPoints / pointsRate),

    // Ví USD
    totalUsd,
    totalPendingUsd,

    // Doanh thu đã xác nhận
    grossRevenueUsd: roundUsd(revenueData.grossUsd),
    memberRevenueUsd: roundUsd(revenueData.memberUsd),
    adminRevenueUsd: roundUsd(revenueData.adminUsd),

    // Tỷ lệ chia doanh thu
    ownerShare: 60,
    customerShare: 40,

    // Tỷ giá
    vndPerUsd: Number(exchangeRate?.vndPerUsd || 26000)
  });
}

// ==============================
// QUẢN LÝ THÀNH VIÊN
// ==============================

export async function users(req, res) {
  const q = String(req.query.q || "").trim();

  const filter = { role: "user" };

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { username: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } }
    ];
  }

  const rows = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(300);

  const ids = rows.map(user => user._id);

  const wallets = await Wallet.find({
    user: { $in: ids }
  });

  const walletMap = new Map(
    wallets.map(wallet => [
      String(wallet.user),
      wallet
    ])
  );

  res.json(
    rows.map(user => ({
      ...publicUser(user),
      wallet: walletMap.get(String(user._id)) || {
        points: 0,
        pendingPoints: 0,
        usdBalance: 0,
        pendingUsd: 0
      }
    }))
  );
}

// ==============================
// ĐIỀU CHỈNH ĐIỂM CŨ
// ==============================

export async function adjustPoints(req, res) {
  const points = Number(req.body.points);

  const note = String(
    req.body.note || "Admin điều chỉnh số dư điểm"
  ).trim().slice(0, 300);

  if (!Number.isSafeInteger(points) || points === 0) {
    return res.status(400).json({
      message: "Số điểm điều chỉnh phải là số nguyên khác 0"
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedWallet;

    await session.withTransaction(async () => {
      updatedWallet = await Wallet.findOneAndUpdate(
        {
          user: req.params.id,
          ...(points < 0
            ? { points: { $gte: Math.abs(points) } }
            : {})
        },
        {
          $inc: { points }
        },
        {
          new: true,
          session
        }
      );

      if (!updatedWallet) {
        throw httpError(
          400,
          "Không tìm thấy ví hoặc số dư điểm không đủ"
        );
      }

      await Transaction.create(
        [{
          user: req.params.id,
          type: "adjustment",
          points,
          note,
          status: "completed"
        }],
        { session }
      );
    });

    res.json({
      message: "Đã cập nhật số dư điểm",
      points: updatedWallet.points,
      balanceVND: Math.floor(
        updatedWallet.points /
        Number(process.env.POINTS_PER_VND || 10)
      )
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    throw error;

  } finally {
    await session.endSession();
  }
}

// ==============================
// ĐIỀU CHỈNH USD
// ==============================

export async function adjustUsd(req, res) {
  const usdAmount = roundUsd(req.body.usdAmount);

  const note = String(
    req.body.note || "Admin điều chỉnh số dư USD"
  ).trim().slice(0, 300);

  if (
    !Number.isFinite(usdAmount) ||
    usdAmount === 0
  ) {
    return res.status(400).json({
      message: "Số USD điều chỉnh không hợp lệ"
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedWallet;

    await session.withTransaction(async () => {
      updatedWallet = await Wallet.findOneAndUpdate(
        {
          user: req.params.id,
          ...(usdAmount < 0
            ? { usdBalance: { $gte: Math.abs(usdAmount) } }
            : {})
        },
        {
          $inc: {
            usdBalance: usdAmount
          }
        },
        {
          new: true,
          session
        }
      );

      if (!updatedWallet) {
        throw httpError(
          400,
          "Không tìm thấy ví hoặc số dư USD không đủ"
        );
      }

      await Transaction.create(
        [{
          user: req.params.id,
          type: "adjustment",
          points: 0,
          usdAmount,
          currency: "USD",
          note,
          status: "completed"
        }],
        { session }
      );
    });

    res.json({
      message: "Đã cập nhật số dư USD",
      usdBalance: roundUsd(updatedWallet.usdBalance)
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    throw error;

  } finally {
    await session.endSession();
  }
}

// ==============================
// CÀI ĐẶT TỶ GIÁ USD/VND
// ==============================

export async function updateExchangeRate(req, res) {
  const vndPerUsd = Number(req.body.vndPerUsd);

  if (
    !Number.isFinite(vndPerUsd) ||
    vndPerUsd < 1 ||
    vndPerUsd > 100000000
  ) {
    return res.status(400).json({
      message: "Tỷ giá USD/VND không hợp lệ"
    });
  }

  const rate = await ExchangeRate.findOneAndUpdate(
    { currency: "USD" },
    {
      $set: {
        vndPerUsd,
        updatedBy: req.user._id,
        note: String(
          req.body.note || "Admin cập nhật tỷ giá"
        ).trim().slice(0, 300)
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );

  res.json({
    message: "Đã cập nhật tỷ giá USD/VND",
    vndPerUsd: rate.vndPerUsd
  });
}

// ==============================
// XEM DOANH THU
// ==============================

export async function revenueSummary(req, res) {
  const rows = await Revenue.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        grossUsd: { $sum: "$grossUsd" },
        memberUsd: { $sum: "$memberUsd" },
        adminUsd: { $sum: "$adminUsd" }
      }
    }
  ]);

  res.json(rows);
}

export async function listRevenue(req, res) {
  const rows = await Revenue.find()
    .populate("user", "username email")
    .sort({ createdAt: -1 })
    .limit(300);

  res.json(rows);
}

// ==============================
// ĐẶT LẠI MẬT KHẨU
// ==============================

export async function resetUserPassword(req, res) {
  const password = String(req.body.password || "");

  if (password.length < 8) {
    return res.status(400).json({
      message: "Mật khẩu mới cần ít nhất 8 ký tự"
    });
  }

  const user = await User.findOne({
    _id: req.params.id,
    role: "user"
  }).select("+password");

  if (!user) {
    return res.status(404).json({
      message: "Không tìm thấy thành viên"
    });
  }

  user.password = await bcrypt.hash(password, 12);

  await user.save();

  res.json({
    message: "Đã đặt lại mật khẩu"
  });
}

// ==============================
// KHÓA / MỞ KHÓA THÀNH VIÊN
// ==============================

export async function toggleUser(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    role: "user"
  });

  if (!user) {
    return res.status(404).json({
      message: "Không tìm thấy thành viên"
    });
  }

  user.status =
    user.status === "active" ? "blocked" : "active";

  await user.save();

  res.json({
    message: "Đã cập nhật trạng thái",
    status: user.status
  });
}

// ==============================
// QUẢN LÝ YÊU CẦU RÚT TIỀN
// ==============================

export async function listWithdrawals(req, res) {
  const rows = await Withdrawal.find()
    .populate("user", "username email")
    .sort({ createdAt: -1 })
    .limit(300);

  res.json(rows);
}

// ==============================
// DUYỆT / TỪ CHỐI RÚT TIỀN
// ==============================

export async function updateWithdrawal(req, res) {
  const status = String(req.body.status || "");

  const adminNote = String(
    req.body.adminNote || ""
  ).trim().slice(0, 300);

  if (!["paid", "rejected"].includes(status)) {
    return res.status(400).json({
      message: "Trạng thái không hợp lệ"
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedWithdrawal;

    await session.withTransaction(async () => {
      // Chỉ xử lý yêu cầu pending
      const item = await Withdrawal.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "pending"
        },
        {
          $set: {
            status,
            adminNote,
            ...(status === "paid"
              ? { paidAt: new Date() }
              : { rejectedAt: new Date() })
          }
        },
        {
          new: true,
          session
        }
      );

      if (!item) {
        throw httpError(
          409,
          "Yêu cầu đã được xử lý hoặc không tồn tại"
        );
      }

      // Nếu từ chối: hoàn lại số dư
      if (status === "rejected") {
        const usdAmount = roundUsd(item.usdAmount || 0);
        const points = Number(item.points || 0);

        if (usdAmount > 0) {
          const wallet = await Wallet.findOneAndUpdate(
            { user: item.user },
            {
              $inc: {
                usdBalance: usdAmount
              }
            },
            {
              new: true,
              session
            }
          );

          if (!wallet) {
            throw new Error(
              "Không tìm thấy ví thành viên để hoàn USD"
            );
          }

          await Transaction.create(
            [{
              user: item.user,
              type: "adjustment",
              points: 0,
              usdAmount,
              currency: "USD",
              note: `Hoàn USD do từ chối rút tiền ${item._id}`,
              reference: String(item._id),
              status: "completed"
            }],
            { session }
          );

        } else if (points > 0) {
          const wallet = await Wallet.findOneAndUpdate(
            { user: item.user },
            {
              $inc: { points }
            },
            {
              new: true,
              session
            }
          );

          if (!wallet) {
            throw new Error(
              "Không tìm thấy ví thành viên để hoàn điểm"
            );
          }

          await Transaction.create(
            [{
              user: item.user,
              type: "adjustment",
              points,
              note: `Hoàn điểm do từ chối rút tiền ${item._id}`,
              reference: String(item._id),
              status: "completed"
            }],
            { session }
          );
        }
      }

      // Cập nhật lịch sử giao dịch rút
      await Transaction.updateOne(
        {
          user: item.user,
          type: "withdrawal",
          reference: String(item._id)
        },
        {
          $set: {
            status: status === "paid"
              ? "completed"
              : "rejected"
          }
        },
        { session }
      );

      updatedWithdrawal = item;
    });

    return res.json({
      message: status === "paid"
        ? "Đã xác nhận thanh toán"
        : "Đã từ chối và hoàn số dư",
      withdrawal: updatedWithdrawal
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    throw error;

  } finally {
    await session.endSession();
  }
}

// ==============================
// TẠO NHIỆM VỤ DEMO
// ==============================

export async function createTask(req, res) {
  const title = String(req.body.title || "").trim();
  const points = Number(req.body.points || 0);

  if (!title) {
    return res.status(400).json({
      message: "Vui lòng nhập tên nhiệm vụ"
    });
  }

  if (!Number.isSafeInteger(points) || points < 0) {
    return res.status(400).json({
      message: "Điểm không hợp lệ"
    });
  }

  const task = await Task.create({
    title,
    description: String(req.body.description || ""),
    category: String(req.body.category || "Khảo sát"),
    points,
    partner: "Demo",
    isDemo: true
  });

  res.status(201).json(task);
}

// ==============================
// BẬT / TẮT NHIỆM VỤ
// ==============================

export async function toggleTask(req, res) {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      message: "Không tìm thấy nhiệm vụ"
    });
  }

  task.active = !task.active;

  await task.save();

  res.json({
    message: "Đã cập nhật nhiệm vụ",
    active: task.active
  });
}
