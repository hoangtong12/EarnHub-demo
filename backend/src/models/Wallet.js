import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
  points: { type: Number, default: 0, min: 0 },
  pendingPoints: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

export default mongoose.model("Wallet", schema);
