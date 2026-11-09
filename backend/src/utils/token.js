import jwt from "jsonwebtoken";

export function makeToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

export function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    bankName: user.bankName || "",
    bankAccount: user.bankAccount || "",
    bankHolder: user.bankHolder || "",
    createdAt: user.createdAt
  };
}
