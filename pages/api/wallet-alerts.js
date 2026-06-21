const { sendTelegramMessage } = require("../../lib/telegram/notify");

const EXPECTED_SYMBOLS = [
  "AVGOON",
  "RKLBON",
  "MRVLON",
  "AMDON",
  "NVDAON",
  "SPCXON",
  "GOOGLON",
  "QQQON",
  "TSMON",
];

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function getQuantity(holding) {
  const raw = holding?.quantity ?? holding?.balance ?? holding?.amount ?? holding?.tokenBalance ?? 0;
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function findAnomalies(holdings) {
  const bySymbol = new Map();
  (holdings || []).forEach((holding) => {
    const symbol = normalizeSymbol(holding.symbol);
    if (!symbol) return;
    bySymbol.set(symbol, holding);
  });

  return EXPECTED_SYMBOLS.map((symbol) => {
    const holding = bySymbol.get(symbol);
    if (!holding) {
      return { symbol, type: "missing", message: "持倉資料缺失" };
    }

    const quantity = getQuantity(holding);
    if (quantity <= 0) {
      return { symbol, type: "zero", quantity, message: "持倉數量為 0" };
    }

    return null;
  }).filter(Boolean);
}

function formatMessage(anomalies, summary) {
  const checkedAt = new Date(summary?.checkedAt || summary?.lastSyncTime || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  if (!anomalies.length) {
    return [
      "✅ DCA折價獵人 Wallet 檢查",
      "",
      "狀態：9檔持倉資料正常",
      `檢查時間：${checkedAt}`,
      `Holdings：${summary?.debugCounts?.holdingsCount ?? summary?.holdings?.length ?? 0}`,
    ].join("\n");
  }

  const lines = [
    "🚨 DCA折價獵人 Wallet警報",
    "",
    `異常數量：${anomalies.length}`,
    `檢查時間：${checkedAt}`,
    "",
  ];

  anomalies.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.symbol}`);
    lines.push(`狀態：${item.message}`);
    if (typeof item.quantity === "number") lines.push(`數量：${item.quantity}`);
    lines.push("請檢查是否為轉出、誤賣、同步失敗或授權異常。");
    lines.push("");
  });

  return lines.join("\n");
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const walletRes = await fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    const wallet = await walletRes.json();

    if (!walletRes.ok) {
      const message = [
        "🔴 DCA折價獵人 Wallet同步異常",
        "",
        "鏈上持倉資料讀取失敗。",
        `錯誤：${wallet.message || wallet.error || walletRes.status}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message);
      return res.status(500).json({ ok: false, alertType: "wallet_sync_error", telegram: sent });
    }

    const anomalies = findAnomalies(wallet.holdings || []);
    const message = formatMessage(anomalies, wallet);

    if (anomalies.length > 0 || String(req.query?.notify || "") === "1") {
      const sent = await sendTelegramMessage(message);
      if (!sent.ok) {
        return res.status(500).json({ ok: false, anomalyCount: anomalies.length, telegram: sent });
      }
      return res.status(200).json({ ok: true, sent: true, anomalyCount: anomalies.length, anomalies });
    }

    return res.status(200).json({ ok: true, sent: false, anomalyCount: 0, message: "wallet_normal" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Wallet alert failed" });
  }
}

module.exports = handler;
