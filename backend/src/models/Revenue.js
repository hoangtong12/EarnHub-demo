
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    // Mã giao dịch duy nhất từ Offerwall
    externalTransactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    partner: {
      type: String,
      required: true,
      default: "Offerwall.me"
    },

    // Thành viên thực hiện nhiệm vụ
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Doanh thu gốc đối tác ghi nhận bằng USD
    grossUsd: {
      type: Number,
      required: true,
      min: 0
    },

    // Thành viên nhận 40%
    memberPercent: {
      type: Number,
      default: 40,
      min: 0,
      max: 100
    },

    memberUsd: {
      type: Number,
      required: true,
      min: 0
    },

    // Admin nhận 60%
    adminPercent: {
      type: Number,
      default: 60,
      min: 0,
      max: 100
    },

    adminUsd: {
      type: Number,
      required: true,
      min: 0
    },

    // Tỷ giá tại thời điểm ghi nhận
    exchangeRate: {
      type: Number,
      default: 0,
      min: 0
    },

    grossVND: {
      type: Number,
      default: 0,
      min: 0
    },

    memberVND: {
      type: Number,
      default: 0,
      min: 0
    },

    adminVND: {
      type: Number,
      default: 0,
      min: 0
    },

    // Trạng thái đối soát
    status: {
      type: String,
      enum: ["pending", "confirmed", "reversed"],
      default: "pending",
      index: true
    },

    description: {
      type: String,
      default: ""
    },

    rawStatus: {
      type: String,
      default: ""
    },

    reversedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

schema.index({ createdAt: -1, status: 1 });

export default mongoose.model("Revenue", schema);
