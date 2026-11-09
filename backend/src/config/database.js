import mongoose from "mongoose";

export default async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  });
  console.log("MongoDB connected:", mongoose.connection.name);
}
