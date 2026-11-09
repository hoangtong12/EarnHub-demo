
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    // Khóa duy nhất để chống xử lý sự kiện trùng
    eventKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // Mã giao dịch từ Offerwall.me
    transId: {
      type: String,
      required: true,
      index: true
    },

    // Loại sự kiện: cộng thưởng hoặc đảo ngược
    eventType: {
      type: String,
      enum: ["credit", "reversal"],
      required: true
    },

    // Thành viên liên quan đến giao dịch
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Số reward nhận từ Offerwall.me
    reward: {
      type: String,
      required: true
    },

    // Doanh thu gốc tính bằng USD
    grossUsd: {
      type: Number,
      default: 0,
      min: 0
    },

    // Đánh dấu sự kiện đã được xử lý
    processed: {
      type: Boolean,
      default: false
    },

    // Ghi chú xử lý
    note: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// Mỗi giao dịch chỉ có một sự kiện credit
// và một sự kiện reversal.
schema.index(
  { transId: 1, eventType: 1 },
  { unique: true }
);

export default mongoose.model("OfferwallEvent", schema);
