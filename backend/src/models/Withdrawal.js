
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Giữ tương thích với yêu cầu rút điểm cũ
    points: {
      type: Number,
      default: 0,
      min: 0
    },

    // Số USD thành viên yêu cầu rút
    usdAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Tỷ giá được khóa tại thời điểm tạo yêu cầu
    exchangeRate: {
      type: Number,
      default: 0,
      min: 0
    },

    // Số tiền VND thực tế cần chuyển
    amountVND: {
      type: Number,
      required: true,
      min: 0
    },

    // Thông tin ngân hàng nhận
    bankName: {
      type: String,
      required: true,
      trim: true
    },

    bankBin: {
      type: String,
      default: "",
      trim: true
    },

    bankAccount: {
      type: String,
      required: true,
      trim: true
    },

    bankHolder: {
      type: String,
      required: true,
      trim: true
    },

    // Nội dung chuyển khoản
    transferContent: {
      type: String,
      default: ""
    },

    // Đường dẫn ảnh QR VietQR
    qrCodeUrl: {
      type: String,
      default: ""
    },

    // Phương thức thanh toán
    paymentMethod: {
      type: String,
      enum: ["manual", "api"],
      default: "manual"
    },

    // Trạng thái xử lý
    status: {
      type: String,
      enum: ["pending", "paid", "rejected"],
      default: "pending",
      index: true
    },

    adminNote: {
      type: String,
      default: ""
    },

    paidAt: {
      type: Date,
      default: null
    },

    rejectedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Withdrawal", schema);
