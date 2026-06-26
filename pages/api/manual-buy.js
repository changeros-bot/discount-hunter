import { appendBuy, normalizeSymbol, normalizeTier } from "../../lib/v16-ledger";

function parseCommand(text) {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  const command = parts[0]?.toLowerCase();

  if (command === "/dca") {
    return {
      symbol: parts[1],
      tier: "N",
      amount: parts[2],
      price: parts[3],
      note: "telegram_dca_manual"
    };
  }

  if (command === "/buy") {
    return {
      symbol: parts[1],
      tier: parts[2],
      amount: parts[3],
      price: parts[4],
      note: "telegram_buy_manual"
    };
  }

  throw new Error("unsupported_command_use_buy_or_dca");
}

function buildTelegramText(result) {
  const modeText = result.tier === "N" ? "DCA定期買入" : `折價買入 ${result.tier}`;
  if (result.duplicate) {
    return [
      "⚠️ 已存在，未重複登帳",
      "",
      `標的：${result.symbol}`,
      `類型：${modeText}`,
      result.row?.time ? `原登帳時間：${result.row.time}` : null
    ].filter(Boolean).join("\n");
  }

  return [
    "✅ 已登帳",
    "",
    `標的：${result.symbol}`,
    `類型：${modeText}`,
    `金額：${result.row.amount}U`,
    result.row.price ? `價格：${result.row.price}` : null,
    `時間：${result.row.time}`
  ].filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const payload = req.body || {};
    const parsed = payload.text ? parseCommand(payload.text) : payload;

    const result = await appendBuy({
      symbol: normalizeSymbol(parsed.symbol),
      tier: normalizeTier(parsed.tier),
      amount: parsed.amount,
      price: parsed.price,
      note: parsed.note || "manual_api"
    });

    return res.status(200).json({
      ok: true,
      ...result,
      replyText: buildTelegramText(result)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
      usage: "/buy NVDAon D1 5 或 /dca NVDAon 5"
    });
  }
}
