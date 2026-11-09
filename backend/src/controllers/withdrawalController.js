
import mongoose from "mongoose";

import Wallet from "../models/Wallet.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction from "../models/Transaction.js";
import ExchangeRate from "../models/ExchangeRate.js";

// Làm tròn USD đến 2 chữ số thập phân
function roundUsd(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Chuẩn hóa dữ liệu dạng chuỗi
function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Lỗi có mã HTTP
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Tạo đường dẫn ảnh VietQR
function createVietQR({
  bankBin,
  bankAccount,
  amount,
  transferContent,
  bankHolder
}) {
  if (!bankBin || !bankAccount || !amount) {
    return "";
  }

  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName: bankHolder
  });

  return (
    `https://img.vietqr.io/image/` +
    `${encodeURIComponent(bankBin)}-` +
    `${encodeURIComponent(bankAccount)}-compact2.png?` +
    params.toString()
  );
}

/*
|--------------------------------------------------------------------------
| 1. THÀNH VIÊN TẠO YÊU CẦU RÚT USD
|--------------------------------------------------------------------------
*/

export async function createWithdrawal(req, res) {
  const bankName = cleanText(req.body.bankName);
  const bankBin = cleanText(req.body.bankBin);
  const bankAccount = cleanText(req.body.bankAccount);
  const bankHolder = cleanText(req.body.bankHolder);

  const usdAmount = roundUsd(req.body.usdAmount);

  const minWithdrawUsd = Number(
    process.env.MIN_WITHDRAW_USD || 1
  );

  const minWithdrawVND = Number(
    process.env.MIN_WITHDRAW_VND || 1000
  );

  if (
    !Number.isFinite(usdAmount) ||
    usdAmount <= 0 ||
    usdAmount < minWithdrawUsd ||
    !bankName ||
    !bankBin ||
    !bankAccount ||
    !bankHolder
  ) {
    return res.status(400).json({
      message: "Thông tin rút USD không hợp lệ"
    });
  }

  if (
    !Number.isFinite(minWithdrawUsd) ||
    minWithdrawUsd <= 0 ||
    !Number.isSafeInteger(minWithdrawVND) ||
    minWithdrawVND <= 0
  ) {
    return res.status(500).json({
      message: "Cấu hình số tiền rút tối thiểu không hợp lệ"
    });
  }

  // Lấy tỷ giá do Admin cài đặt
  const exchangeRate = await ExchangeRate.findOne({
    currency: "USD"
  });

  if (
    !exchangeRate ||
    !Number.isFinite(exchangeRate.vndPerUsd) ||
    exchangeRate.vndPerUsd <= 0
  ) {
    return res.status(400).json({
      message: "Admin chưa cài đặt tỷ giá USD/VND"
    });
  }

  // Khóa tỷ giá tại thời điểm thành viên tạo yêu cầu
  const lockedRate = Number(exchangeRate.vndPerUsd);

  const amountVND = Math.round(
    usdAmount * lockedRate
  );

  if (
    !Number.isSafeInteger(amountVND) ||
    amountVND <= 0
  ) {
    return res.status(400).json({
      message: "Số tiền VND không hợp lệ"
    });
  }

  if (amountVND < minWithdrawVND) {
    return res.status(400).json({
      message:
        `Số tiền rút tối thiểu là ` +
        `${minWithdrawVND.toLocaleString("vi-VN")}đ`
    });
  }

  // Tạo mã chuyển khoản trước khi bắt đầu transaction
  const transferContent =
    `EH${Date.now()}${String(req.user._id).slice(-6)}`;

  const qrCodeUrl = createVietQR({
    bankBin,
    bankAccount,
    amount: amountVND,
    transferContent,
    bankHolder
  });

  const session = await mongoose.startSession();

  let withdrawalItem;

  try {
    await session.withTransaction(async () => {
      // Trừ USD có điều kiện, tránh rút vượt số dư
      const wallet = await Wallet.findOneAndUpdate(
        {
          user: req.user._id,
          usdBalance: { $gte: usdAmount }
        },
        {
          $inc: {
            usdBalance: -usdAmount
          }
        },
        {
          new: true,
          session
        }
      );

      if (!wallet) {
        throw httpError(
          400,
          "Số dư USD không đủ"
        );
      }

      // Tạo yêu cầu rút tiền
      withdrawalItem = new Withdrawal({
        user: req.user._id,
        points: 0,
        usdAmount,
        exchangeRate: lockedRate,
        amountVND,
        bankName,
        bankBin,
        bankAccount,
        bankHolder,
        transferContent,
        qrCodeUrl,
        paymentMethod: "manual",
        status: "pending"
      });

      await withdrawalItem.save({ session });

      // Ghi lịch sử giao dịch
      const transaction = new Transaction({
        user: req.user._id,
        type: "withdrawal",
        points: 0,
        usdAmount: -usdAmount,
        amountVND,
        exchangeRate: lockedRate,
        currency: "USD",
        note: "Tạo yêu cầu rút USD",
        status: "pending",
        reference: String(withdrawalItem._id)
      });

      await transaction.save({ session });
    });

    return res.status(201).json({
      message: "Tạo yêu cầu rút USD thành công",
      withdrawal: withdrawalItem
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

/*
|--------------------------------------------------------------------------
| 2. THÀNH VIÊN XEM LỊCH SỬ RÚT TIỀN
|--------------------------------------------------------------------------
*/

export async function myWithdrawals(req, res) {
  const rows = await Withdrawal.find({
    user: req.user._id
  }).sort({
    createdAt: -1
  });

  return res.json(rows);
}

/*
|--------------------------------------------------------------------------
| 3. API RÚT ĐIỂM CŨ - GIỮ TƯƠNG THÍCH DỮ LIỆU
|--------------------------------------------------------------------------
*/

export async function createLegacyWithdrawal(req, res) {
  const points = Number(req.body.points);

  const bankName = cleanText(req.body.bankName);
  const bankAccount = cleanText(req.body.bankAccount);
  const bankHolder = cleanText(req.body.bankHolder);

  const rate = Number(
    process.env.POINTS_PER_VND || 10
  );

  const minVnd = Number(
    process.env.MIN_WITHDRAW_VND || 1000
  );

  if (
    !Number.isSafeInteger(points) ||
    points <= 0 ||
    !bankName ||
    !bankAccount ||
    !bankHolder ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isSafeInteger(minVnd) ||
    minVnd <= 0
  ) {
    return res.status(400).json({
      message: "Thông tin rút điểm không hợp lệ"
    });
  }

  const amountVND = Math.floor(points / rate);

  if (
    !Number.isSafeInteger(amountVND) ||
    amountVND < minVnd
  ) {
    return res.status(400).json({
      message:
        `Số tiền rút tối thiểu là ` +
        `${minVnd.toLocaleString("vi-VN")}đ`
    });
  }

  const session = await mongoose.startSession();

  let withdrawalItem;

  try {
    await session.withTransaction(async () => {
      // Trừ điểm có điều kiện
      const wallet = await Wallet.findOneAndUpdate(
        {
          user: req.user._id,
          points: { $gte: points }
        },
        {
          $inc: {
            points: -points
          }
        },
        {
          new: true,
          session
        }
      );

      if (!wallet) {
        throw httpError(
          400,
          "Số dư điểm không đủ"
        );
      }

      // Tạo yêu cầu rút điểm
      withdrawalItem = new Withdrawal({
        user: req.user._id,
        points,
        usdAmount: 0,
        exchangeRate: 0,
        amountVND,
        bankName,
        bankAccount,
        bankHolder,
        paymentMethod: "manual",
        status: "pending"
      });

      await withdrawalItem.save({ session });

      // Ghi lịch sử giao dịch cũ
      const transaction = new Transaction({
        user: req.user._id,
        type: "withdrawal",
        points: -points,
        note: "Tạo yêu cầu rút điểm cũ",
        status: "pending",
        reference: String(withdrawalItem._id)
      });

      await transaction.save({ session });
    });

    return res.status(201).json({
      message: "Tạo yêu cầu rút điểm thành công",
      withdrawal: withdrawalItem
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
