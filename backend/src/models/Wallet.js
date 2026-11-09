
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true
    },

    // Số điểm cũ: giữ nguyên dữ liệu hiện tại
    points: {
      type: Number,
      default: 0,
      min: 0
    },

    pendingPoints: {
      type: Number,
      default: 0,
      min: 0
    },

    // Số USD thành viên có thể sử dụng/rút
    usdBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    // USD đang chờ Offerwall xác nhận
    pendingUsd: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", schema);
