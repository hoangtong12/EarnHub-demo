import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Task from "../models/Task.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction from "../models/Transaction.js";
import { publicUser } from "../utils/token.js";

export async function dashboard(req, res) {
  const [members, pendingWithdrawals, tasks, wallets] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Withdrawal.countDocuments({ status: "pending" }),
    Task.countDocuments(),
    Wallet.find().select("points")
  ]);
  const totalPoints = wallets.reduce((sum, wallet) => sum + wallet.points, 0);
  const rate = Number(process.env.POINTS_PER_VND || 10);
  res.json({
    members, pendingWithdrawals, tasks, totalPoints,
    totalBalanceVND: Math.floor(totalPoints / rate),
    ownerShare: Number(process.env.OWNER_SHARE_PERCENT || 60),
    customerShare: Number(process.env.CUSTOMER_SHARE_PERCENT || 40)
  });
}

export async function users(req, res) {
  const q = String(req.query.q || "").trim();
  const filter = { role: "user" };
  if (q) {
    filter.$or = [
      { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    ];
  }
  const rows = await User.find(filter).sort({ createdAt: -1 }).limit(300);
  const ids = rows.map(user => user._id);
  const wallets = await Wallet.find({ user: { $in: ids } });
  const map = new Map(wallets.map(wallet => [String(wallet.user), wallet]));
  res.json(rows.map(user => ({
    ...publicUser(user),
    wallet: map.get(String(user._id)) || { points: 0, pendingPoints: 0 }
  })));
}

export async function adjustPoints(req, res) {
  const points = Number(req.body.points);
  const note = String(req.body.note || "Admin điều chỉnh số dư").trim().slice(0, 300);
  if (!Number.isSafeInteger(points) || points === 0) {
    return res.status(400).json({ message: "Số điểm điều chỉnh phải là số nguyên khác 0" });
  }

  const wallet = await Wallet.findOneAndUpdate(
    { user: req.params.id, ...(points < 0 ? { points: { $gte: Math.abs(points) } } : {}) },
    { $inc: { points } },
    { new: true }
  );
  if (!wallet) return res.status(400).json({ message: "Không tìm thấy ví hoặc số dư không đủ" });

  try {
    await Transaction.create({
      user: req.params.id, type: "adjustment", points, note, status: "completed"
    });
  } catch (error) {
    await Wallet.updateOne({ user: req.params.id }, { $inc: { points: -points } });
    throw error;
  }
  res.json({
    message: "Đã cập nhật số dư",
    points: wallet.points,
    balanceVND: Math.floor(wallet.points / Number(process.env.POINTS_PER_VND || 10))
  });
}

export async function resetUserPassword(req, res) {
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ message: "Mật khẩu mới cần ít nhất 8 ký tự" });
  const user = await User.findOne({ _id: req.params.id, role: "user" }).select("+password");
  if (!user) return res.status(404).json({ message: "Không tìm thấy thành viên" });
  user.password = await bcrypt.hash(password, 12);
  await user.save();
  res.json({ message: "Đã đặt lại mật khẩu" });
}

export async function toggleUser(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: "user" });
  if (!user) return res.status(404).json({ message: "Không tìm thấy thành viên" });
  user.status = user.status === "active" ? "blocked" : "active";
  await user.save();
  res.json({ message: "Đã cập nhật trạng thái", status: user.status });
}

export async function listWithdrawals(req, res) {
  const rows = await Withdrawal.find().populate("user", "username email").sort({ createdAt: -1 }).limit(300);
  res.json(rows);
}

export async function updateWithdrawal(req, res) {
  const status = String(req.body.status || "");
  const adminNote = String(req.body.adminNote || "").trim().slice(0, 300);
  if (!["paid", "rejected"].includes(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ" });

  // Atomic state transition: only one request can change pending -> paid/rejected.
  const item = await Withdrawal.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    { $set: { status, adminNote } },
    { new: true }
  );
  if (!item) return res.status(409).json({ message: "Yêu cầu đã được xử lý hoặc không tồn tại" });

  if (status === "rejected") {
    await Wallet.updateOne({ user: item.user }, { $inc: { points: item.points } });
    await Transaction.create({
      user: item.user, type: "adjustment", points: item.points,
      note: `Hoàn điểm do từ chối rút tiền ${item._id}`,
      reference: String(item._id), status: "completed"
    });
  }

  await Transaction.updateOne(
    { user: item.user, type: "withdrawal", reference: String(item._id) },
    { $set: { status: status === "paid" ? "completed" : "rejected" } }
  );

  res.json({ message: status === "paid" ? "Đã đánh dấu đã thanh toán" : "Đã từ chối và hoàn điểm" });
}

export async function createTask(req, res) {
  const title = String(req.body.title || "").trim();
  const points = Number(req.body.points || 0);
  if (!title) return res.status(400).json({ message: "Vui lòng nhập tên nhiệm vụ" });
  if (!Number.isSafeInteger(points) || points < 0) return res.status(400).json({ message: "Điểm không hợp lệ" });
  const task = await Task.create({
    title, description: String(req.body.description || ""),
    category: String(req.body.category || "Khảo sát"),
    points, partner: "Demo", isDemo: true
  });
  res.status(201).json(task);
}

export async function toggleTask(req, res) {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Không tìm thấy nhiệm vụ" });
  task.active = !task.active;
  await task.save();
  res.json({ message: "Đã cập nhật nhiệm vụ", active: task.active });
}
