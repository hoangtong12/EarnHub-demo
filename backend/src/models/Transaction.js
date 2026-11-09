
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Giữ các loại giao dịch cũ và bổ sung Offerwall
    type: {
      type: String,
      enum: [
        "reward",
        "withdrawal",
        "adjustment",
        "offerwall_reward",
        "offerwall_reversal"
      ],
      required: true
    },

    // Điểm cũ: giữ nguyên để tương thích dữ liệu hiện tại
    points: {
      type: Number,
      default: 0
    },

    // Số USD giao dịch (làm tròn 2 chữ số thập phân)
    usdAmount: {
      type: Number,
      default: 0
    },

    // Số VNĐ tương ứng nếu có quy đổi
    amountVND: {
      type: Number,
      default: 0
    },

    // Tỷ giá USD/VND tại thời điểm giao dịch
    exchangeRate: {
      type: Number,
      default: 0
    },

    // Đơn vị tiền của giao dịch
    currency: {
      type: String,
      enum: ["POINTS", "USD", "VND"],
      default: "POINTS"
    },

    note: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: [
        "completed",
        "pending",
        "rejected",
        "reversed"
      ],
      default: "completed"
    },

    // Mã tham chiếu nội bộ hoặc mã yêu cầu rút
    reference: {
      type: String,
      default: "",
      index: true
    },

    // Đối tác cung cấp nhiệm vụ
    partner: {
      type: String,
      default: ""
    },

    // Mã giao dịch từ Offerwall
    externalTransactionId: {
      type: String,
      default: "",
      index: true
    }

  },
  { timestamps: true }
);

schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Transaction", schema);
