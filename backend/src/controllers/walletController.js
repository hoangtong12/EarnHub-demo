import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

export async function summary(req, res) {
  const wallet = await Wallet.findOne({ user: req.user._id });
  const points = wallet?.points || 0;
  const rate = Number(process.env.POINTS_PER_VND || 10);
  const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json({
    points,
    balanceVND: Math.floor(points / rate),
    pendingPoints: wallet?.pendingPoints || 0,
    transactions,
    conversion: `${rate} điểm = 1đ`
  });
}

export async function transactions(req, res) {
  const rows = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json(rows);
}
