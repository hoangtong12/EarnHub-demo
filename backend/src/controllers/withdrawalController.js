import Wallet from "../models/Wallet.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction from "../models/Transaction.js";

export async function createWithdrawal(req, res) {
  const points = Number(req.body.points);
  const bankName = String(req.body.bankName || "").trim();
  const bankAccount = String(req.body.bankAccount || "").trim();
  const bankHolder = String(req.body.bankHolder || "").trim();
  const rate = Number(process.env.POINTS_PER_VND || 10);
  const minVnd = Number(process.env.MIN_WITHDRAW_VND || 1000);

  if (!Number.isSafeInteger(points) || points <= 0 || !bankName || !bankAccount || !bankHolder) {
    return res.status(400).json({ message: "Thông tin rút tiền không hợp lệ" });
  }
  const amountVND = Math.floor(points / rate);
  if (amountVND < minVnd) return res.status(400).json({ message: `Số tiền rút tối thiểu là ${minVnd.toLocaleString("vi-VN")}đ` });

  const wallet = await Wallet.findOneAndUpdate(
    { user: req.user._id, points: { $gte: points } },
    { $inc: { points: -points } },
    { new: true }
  );
  if (!wallet) return res.status(400).json({ message: "Số dư không đủ" });

  try {
    const item = await Withdrawal.create({
      user: req.user._id, points, amountVND, bankName, bankAccount, bankHolder
    });
    await Transaction.create({
      user: req.user._id, type: "withdrawal", points: -points,
      note: "Tạo yêu cầu rút tiền", status: "pending", reference: String(item._id)
    });
    res.status(201).json(item);
  } catch (error) {
    await Wallet.updateOne({ user: req.user._id }, { $inc: { points } });
    throw error;
  }
}

export async function myWithdrawals(req, res) {
  res.json(await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 }));
}
