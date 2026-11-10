
import { createOfferwallIdentity } from "../utils/offerwallIdentity.js";

const OFFERWALL_ENDPOINTS = {
  tasks: "https://offerwall.me/taskapi.php",
  offers: "https://offerwall.me/offerapi.php",
  surveys: "https://offerwall.me/surveyapi.php"
};

function getMemberId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.user?.sub ||
    null
  );
}

function getClientIp(req) {
  let ip = req.ip || req.socket?.remoteAddress || "";

  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  return ip;
}

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.3") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

async function getCountryCode(ip, user) {
  const profileCountry = String(user?.country || "").trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(profileCountry)) {
    return profileCountry;
  }

  if (!isPrivateIp(ip)) {
    try {
      const response = await fetch(
        `https://ipapi.co/${encodeURIComponent(ip)}/country/`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (response.ok) {
        const country = (await response.text()).trim().toUpperCase();

        if (/^[A-Z]{2}$/.test(country)) {
          return country;
        }
      }
    } catch (error) {
      console.error("Offerwall country lookup failed:", error.message);
    }
  }

  const fallback = String(
    process.env.OFFERWALL_DEFAULT_COUNTRY || "VN"
  ).trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(fallback)) {
    return fallback;
  }

  throw new Error("Không xác định được quốc gia thành viên");
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.offers)) return payload.offers;
  if (Array.isArray(payload?.tasks)) return payload.tasks;
  if (Array.isArray(payload?.surveys)) return payload.surveys;

  return [];
}

async function requestOfferwall(type, req) {
  const endpoint = OFFERWALL_ENDPOINTS[type];

  if (!endpoint) {
    throw new Error("Loại nhiệm vụ không hợp lệ");
  }

  const publicKey = process.env.OFFERWALL_PUBLIC_KEY;
  const bearerToken = process.env.OFFERWALL_BEARER_TOKEN;

  if (!publicKey || !bearerToken || !process.env.OFFERWALL_SECRET_KEY) {
    throw new Error("Offerwall.me chưa được cấu hình đầy đủ trên máy chủ");
  }

  const memberId = getMemberId(req);

  if (!memberId) {
    throw new Error("Không xác định được tài khoản thành viên đăng nhập");
  }

  const ip = getClientIp(req);

  if (!ip) {
    throw new Error("Không xác định được IP thành viên");
  }

  const country = await getCountryCode(ip, req.user);
  const identity = createOfferwallIdentity(memberId);

  const params = new URLSearchParams({
    api: publicKey,
    token: bearerToken,
    id: identity.userId,
    identityExpires: String(identity.identityExpires),
    identitySignature: identity.identitySignature,
    ip,
    country
  });

  if (type === "surveys") {
    params.set(
      "user_agent",
      req.get("user-agent") || "EarnHub Pro"
    );
  }

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });

  const responseText = await response.text();

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Offerwall.me trả về dữ liệu không hợp lệ (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    console.error(`Offerwall ${type} API error:`, payload);
    throw new Error(`Offerwall.me hiện không thể tải ${type}`);
  }

  if (payload?.error) {
    console.error(`Offerwall ${type} response error:`, payload.error);
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Offerwall.me báo lỗi khi tải ${type}`
    );
  }

  return {
    rows: extractRows(payload),
    country
  };
}

function createListHandler(type) {
  return async function (req, res) {
    try {
      const result = await requestOfferwall(type, req);

      return res.json({
        success: true,
        source: "Offerwall.me",
        type,
        country: result.country,
        count: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      console.error(`Load Offerwall ${type} failed:`, error.message);

      return res.status(502).json({
        success: false,
        message: error.message || "Không thể tải nhiệm vụ từ Offerwall.me",
        data: []
      });
    }
  };
}

export const listOfferwallTasks = createListHandler("tasks");
export const listOfferwallOffers = createListHandler("offers");
export const listOfferwallSurveys = createListHandler("surveys");
