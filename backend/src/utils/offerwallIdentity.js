
import crypto from "node:crypto";

export function createOfferwallIdentity(userId) {
  const publicKey = process.env.OFFERWALL_PUBLIC_KEY;
  const secretKey = process.env.OFFERWALL_SECRET_KEY;

  if (!publicKey || !secretKey) {
    throw new Error("Thiếu cấu hình Offerwall.me");
  }

  if (!userId) {
    throw new Error("Thiếu ID thành viên");
  }

  const exactUserId = String(userId);

  // Thời hạn 1 giờ tính theo Unix seconds
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  // Chuỗi ký chính xác theo tài liệu Offerwall.me
  const message = [
    "offerwall-user-v1",
    publicKey,
    exactUserId,
    String(expiry)
  ].join("\n");

  // HMAC-SHA256
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message, "utf8")
    .digest("hex");

  return {
    publicKey,
    userId: exactUserId,
    identityExpires: expiry,
    identitySignature: signature
  };
}
