import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["reward", "withdrawal", "adjustment"], required: true },
  points: { type: Number, required: true },
  note: { type: String, default: "" },
  status: { type: String, enum: ["completed", "pending", "rejected"], default: "completed" },
  reference: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Transaction", schema);
