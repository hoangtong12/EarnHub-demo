import mongoose from "mongoose";

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  status: { type: String, enum: ["active", "blocked"], default: "active" },
  bankName: { type: String, default: "" },
  bankAccount: { type: String, default: "" },
  bankHolder: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("User", schema);
