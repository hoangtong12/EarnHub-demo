import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../src/config/database.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";

async function run() {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    throw new Error("Hãy đặt ADMIN_PASSWORD tối thiểu 8 ký tự trong backend/.env");
  }
  await connectDB();
  const username = process.env.ADMIN_USERNAME || "EarnHubAdmin";
  const email = (process.env.ADMIN_EMAIL || "admin@earnhub.local").toLowerCase();
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

  let admin = await User.findOne({ role: "admin" });
  if (admin) {
    admin.username = username;
    admin.email = email;
    admin.password = password;
    admin.status = "active";
    await admin.save();
  } else {
    admin = await User.create({ username, email, password, role: "admin", status: "active" });
  }
  await Wallet.updateOne({ user: admin._id }, { $setOnInsert: { points: 0 } }, { upsert: true });
  console.log("ADMIN READY");
  console.log("Username:", username);
  console.log("Email:", email);
  await mongoose.disconnect();
}
run().catch(error => {
  console.error("Seed admin failed:", error.message);
  process.exit(1);
});
