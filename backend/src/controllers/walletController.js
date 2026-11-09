
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import ExchangeRate from "../models/ExchangeRate.js";

function roundUsd(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function summary(req, res) {
  const [wallet, exchangeRate, transactions] = await Promise.all([
    Wallet.findOne({ user: req.user._id }),
    ExchangeRate.findOne({ currency: "USD" }),
    Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
  ]);

  const points = wallet?.points || 0;
  const pendingPoints = wallet?.pendingPoints || 0;

  const usdBalance = roundUsd(wallet?.usdBalance || 0);
  const pendingUsd = roundUsd(wallet?.pendingUsd || 0);

  const vndPerUsd = Number(exchangeRate?.vndPerUsd || 26000);

  res.json({
    // Ví USD mới
    currency: "USD",
    usdBalance,
    pendingUsd,

    // Tỷ giá chỉ dùng để tham khảo khi rút tiền
    vndPerUsd,

    // Ví điểm cũ: giữ để tương thích dữ liệu
    points,
    pendingPoints,
    balanceVND: Math.floor(points / Number(process.env.POINTS_PER_VND || 10)),
    conversion: `${Number(process.env.POINTS_PER_VND || 10)} điểm = 1đ`,

    transactions
  });
}

export async function transactions(req, res) {
  const rows = await Transaction.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);

  res.json(rows);
}
