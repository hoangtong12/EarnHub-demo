import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, required: true },
  amountVND: { type: Number, required: true },
  bankName: { type: String, required: true },
  bankAccount: { type: String, required: true },
  bankHolder: { type: String, required: true },
  status: { type: String, enum: ["pending", "paid", "rejected"], default: "pending" },
  adminNote: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Withdrawal", schema);
