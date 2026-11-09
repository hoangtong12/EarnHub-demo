
import crypto from "node:crypto";
import mongoose from "mongoose";

import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import Revenue from "../models/Revenue.js";
import OfferwallEvent from "../models/OfferwallEvent.js";
import ExchangeRate from "../models/ExchangeRate.js";

const MEMBER_PERCENT = 40;
const ADMIN_PERCENT = 60;

const PARTNER_NAME = "Offerwall.me";

// ==========================================
// NUMBER HELPERS
// ==========================================

function roundUsd(value) {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}

function parseAmount(value) {
  if (value === undefined || value === null || value === "") {
    return NaN;
  }

  // Accept decimal comma, e.g. 1,23
  const normalized = String(value).trim().replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : NaN;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

// ==========================================
// POSTBACK PARAMETER HELPERS
// ==========================================

function getParams(req) {
  return {
    ...req.query,
    ...req.body
  };
}

// ==========================================
// SIGNATURE VERIFICATION
// ==========================================

function verifySignature({
  subId,
  transId,
  reward,
  signature,
  secret
}) {
  if (!subId || !transId || !reward || !signature || !secret) {
    return false;
  }

  // Offerwall.me signature format assumed:
  // MD5(subId + transId + reward + secretKey)

  const expected = crypto
    .createHash("md5")
    .update(`${subId}${transId}${reward}${secret}`, "utf8")
    .digest("hex");

  const received = String(signature).trim().toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(received)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

// ==========================================
// EXCHANGE RATE
// ==========================================

async function getUsdVndRate(session) {
  const rate = await ExchangeRate.findOne({
    currency: "USD"
  }).session(session);

  const value = Number(rate?.vndPerUsd || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

// ==========================================
// RESPONSE HELPERS
// ==========================================

function successResponse(res) {
  return res.status(200).send("ok");
}

function errorResponse(res, status, message) {
  return res.status(status).send(message);
}

// ==========================================
// MAIN OFFERWALL POSTBACK
// ==========================================

export async function handleOfferwallPostback(req, res) {
  const params = getParams(req);

  const subId = String(params.subId || "").trim();
  const transId = String(params.transId || "").trim();

  // Keep the original reward string for signature verification.
  const rewardRaw = String(params.reward ?? "").trim();

  const signature = String(params.signature || "").trim();
  const status = String(params.status || "").trim();

  const secret = process.env.OFFERWALL_SECRET_KEY;

  try {
    // ======================================
    // 1. TEST POSTBACK
    // ======================================

    const isDebug = String(params.debug || "") === "1";
    const isTestTransaction = /^TEST-/i.test(transId);

    // Test callbacks must NEVER credit real wallets.
    if (isDebug || isTestTransaction) {
      console.log("================================");
      console.log("OFFERWALL TEST POSTBACK");
      console.log({
        subId,
        transId,
        reward: rewardRaw,
        status,
        debug: params.debug || "0"
      });
      console.log("No wallet or revenue changes made.");
      console.log("================================");

      return successResponse(res);
    }

    // ======================================
    // 2. CHECK CONFIGURATION
    // ======================================

    if (!secret) {
      console.error("Missing OFFERWALL_SECRET_KEY");

      return errorResponse(
        res,
        500,
        "Server configuration error"
      );
    }

    // ======================================
    // 3. CHECK REQUIRED PARAMETERS
    // ======================================

    if (!subId || !transId || !rewardRaw || !signature || !status) {
      return errorResponse(
        res,
        400,
        "Missing required parameters"
      );
    }

    if (!["1", "2"].includes(status)) {
      return errorResponse(
        res,
        400,
        "Unsupported postback status"
      );
    }

    if (transId.length > 200) {
      return errorResponse(
        res,
        400,
        "Invalid transaction ID"
      );
    }

    const rewardNumber = parseAmount(rewardRaw);

    if (!isPositiveNumber(rewardNumber)) {
      return errorResponse(
        res,
        400,
        "Invalid reward"
      );
    }

    if (!mongoose.isValidObjectId(subId)) {
      return errorResponse(
        res,
        400,
        "Invalid user ID"
      );
    }

    // ======================================
    // 4. VERIFY SIGNATURE
    // ======================================

    const signatureValid = verifySignature({
      subId,
      transId,
      reward: rewardRaw,
      signature,
      secret
    });

    if (!signatureValid) {
      console.error("Invalid Offerwall signature:", transId);

      return errorResponse(
        res,
        403,
        "Invalid signature"
      );
    }

    // ======================================
    // 5. APPROVED TRANSACTION
    // status = 1
    // ======================================

    if (status === "1") {
      const payout = parseAmount(params.payout);

      if (!isPositiveNumber(payout)) {
        return errorResponse(
          res,
          400,
          "Invalid payout"
        );
      }

      const grossUsd = roundUsd(payout);

      const memberUsd = roundUsd(
        grossUsd * MEMBER_PERCENT / 100
      );

      const adminUsd = roundUsd(
        grossUsd - memberUsd
      );

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Check whether this transaction was already credited.
          const existingRevenue = await Revenue.findOne({
            externalTransactionId: transId
          }).session(session);

          if (existingRevenue) {
            return;
          }

          const existingCredit = await OfferwallEvent.findOne({
            transId,
            eventType: "credit"
          }).session(session);

          if (existingCredit) {
            return;
          }

          // If reversal arrived first, do not credit this transaction.
          const existingReversal = await OfferwallEvent.findOne({
            transId,
            eventType: "reversal"
          }).session(session);

          if (existingReversal) {
            await OfferwallEvent.create(
              [
                {
                  eventKey: `${transId}:credit`,
                  transId,
                  eventType: "credit",
                  user: subId,
                  reward: rewardRaw,
                  grossUsd,
                  processed: true,
                  note: "Credit skipped because reversal was already received"
                }
              ],
              { session }
            );

            return;
          }

          // Find member
          const user = await User.findById(subId).session(session);

          if (!user) {
            throw new Error("OFFERWALL_USER_NOT_FOUND");
          }

          // Find or create wallet
          let wallet = await Wallet.findOne({
            user: user._id
          }).session(session);

          if (!wallet) {
            wallet = new Wallet({
              user: user._id
            });
          }

          // Credit only 40% to the member's USD wallet.
          // Legacy points and pending balances remain unchanged.
          wallet.usdBalance = roundUsd(
            Number(wallet.usdBalance || 0) + memberUsd
          );

          await wallet.save({ session });

          // Read actual USD/VND exchange rate.
          const exchangeRate = await getUsdVndRate(session);

          const grossVND = Math.round(
            grossUsd * exchangeRate
          );

          const memberVND = Math.round(
            memberUsd * exchangeRate
          );

          const adminVND = Math.round(
            adminUsd * exchangeRate
          );

          // Save revenue record.
          await Revenue.create(
            [
              {
                externalTransactionId: transId,
                partner: PARTNER_NAME,
                user: user._id,

                grossUsd,

                memberPercent: MEMBER_PERCENT,
                memberUsd,

                adminPercent: ADMIN_PERCENT,
                adminUsd,

                exchangeRate,
                grossVND,
                memberVND,
                adminVND,

                status: "confirmed",

                description: String(
                  params.offer_name || "Offerwall completion"
                ).slice(0, 500),

                rawStatus: status
              }
            ],
            { session }
          );

          // Save member wallet transaction.
          await Transaction.create(
            [
              {
                user: user._id,
                type: "offerwall_reward",
                currency: "USD",
                usdAmount: memberUsd,
                points: 0,
                status: "completed",

                reference: transId,
                externalTransactionId: `${transId}:credit`,

                partner: PARTNER_NAME,

                note: `Offerwall reward. Gross: ${grossUsd} USD. Member share: ${memberUsd} USD.`
              }
            ],
            { session }
          );

          // Save event for duplicate protection.
          await OfferwallEvent.create(
            [
              {
                eventKey: `${transId}:credit`,
                transId,
                eventType: "credit",
                user: user._id,
                reward: rewardRaw,
                grossUsd,
                processed: true,
                note: "Offerwall reward credited successfully"
              }
            ],
            { session }
          );

          console.log("Offerwall reward credited:", {
            transId,
            userId: String(user._id),
            grossUsd,
            memberUsd,
            adminUsd
          });
        });

        return successResponse(res);
      } finally {
        await session.endSession();
      }
    }

    // ======================================
    // 6. REVERSED TRANSACTION
    // status = 2
    // ======================================

    if (status === "2") {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Prevent duplicate reversals.
          const existingReversal = await OfferwallEvent.findOne({
            transId,
            eventType: "reversal"
          }).session(session);

          if (existingReversal) {
            return;
          }

          const revenue = await Revenue.findOne({
            externalTransactionId: transId
          }).session(session);

          // Reversal arrived before approval.
          // Record it so a later approval cannot credit the wallet.
          if (!revenue) {
            await OfferwallEvent.create(
              [
                {
                  eventKey: `${transId}:reversal`,
                  transId,
                  eventType: "reversal",
                  user: null,
                  reward: rewardRaw,
                  grossUsd: 0,
                  processed: true,
                  note: "Reversal received before credit; no wallet changes made"
                }
              ],
              { session }
            );

            return;
          }

          if (revenue.status === "reversed") {
            return;
          }

          const wallet = await Wallet.findOne({
            user: revenue.user
          }).session(session);

          const amountToReverse = roundUsd(
            Number(revenue.memberUsd || 0)
          );

          let amountRecovered = 0;

          if (wallet && amountToReverse > 0) {
            const currentBalance = Number(
              wallet.usdBalance || 0
            );

            // Never allow negative wallet balance.
            amountRecovered = roundUsd(
              Math.min(currentBalance, amountToReverse)
            );

            wallet.usdBalance = roundUsd(
              currentBalance - amountRecovered
            );

            await wallet.save({ session });
          }

          const outstandingAmount = roundUsd(
            amountToReverse - amountRecovered
          );

          // Mark original revenue as reversed.
          revenue.status = "reversed";
          revenue.reversedAt = new Date();

          revenue.description = [
            revenue.description || "Offerwall transaction",
            `Reversed: ${amountRecovered} USD recovered.`,
            `Outstanding: ${outstandingAmount} USD.`
          ].join(" | ");

          await revenue.save({ session });

          // Record the actual amount recovered.
          await Transaction.create(
            [
              {
                user: revenue.user,
                type: "offerwall_reversal",
                currency: "USD",
                usdAmount: -amountRecovered,
                points: 0,
                status: "reversed",

                reference: transId,
                externalTransactionId: `${transId}:reversal`,

                partner: PARTNER_NAME,

                note:
                  outstandingAmount > 0
                    ? `Offerwall reversal. Recovered ${amountRecovered} USD. Outstanding ${outstandingAmount} USD requires admin review.`
                    : "Offerwall reversal recovered successfully."
              }
            ],
            { session }
          );

          // Save reversal event.
          await OfferwallEvent.create(
            [
              {
                eventKey: `${transId}:reversal`,
                transId,
                eventType: "reversal",
                user: revenue.user,
                reward: rewardRaw,
                grossUsd: amountToReverse,
                processed: true,

                note:
                  outstandingAmount > 0
                    ? `Partial recovery: ${amountRecovered} USD. Outstanding: ${outstandingAmount} USD. Admin review required.`
                    : "Reversal processed successfully."
              }
            ],
            { session }
          );

          console.log("Offerwall reversal processed:", {
            transId,
            userId: String(revenue.user),
            amountToReverse,
            amountRecovered,
            outstandingAmount
          });
        });

        return successResponse(res);
      } finally {
        await session.endSession();
      }
    }

    return errorResponse(
      res,
      400,
      "Unsupported postback"
    );

  } catch (error) {
    // Duplicate database key: treat as already processed.
    if (error.code === 11000) {
      console.log("Duplicate Offerwall event:", transId);
      return successResponse(res);
    }

    if (error.message === "OFFERWALL_USER_NOT_FOUND") {
      console.error("Offerwall user not found:", subId);

      return errorResponse(
        res,
        404,
        "User not found"
      );
    }

    console.error("Offerwall postback processing error:", error);

    return errorResponse(
      res,
      500,
      "Postback processing failed"
    );
  }
}
