
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    description: {
      type: String,
      default: ""
    },

    category: {
      type: String,
      default: "Khảo sát"
    },

    points: {
      type: Number,
      default: 0,
      min: 0
    },

    partner: {
      type: String,
      default: "Demo"
    },

    isDemo: {
      type: Boolean,
      default: true
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Task", schema);
