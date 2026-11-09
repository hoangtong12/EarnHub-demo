
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    currency: {
      type: String,
      default: "USD",
      unique: true,
      immutable: true
    },

    vndPerUsd: {
      type: Number,
      required: true,
      min: 1,
      default: 26000
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    note: {
      type: String,
      default: "Admin cài đặt tỷ giá"
    }
  },
  { timestamps: true }
);

export default mongoose.model("ExchangeRate", schema);
