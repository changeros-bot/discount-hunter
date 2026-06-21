const { sendTelegramMessage } = require("../../lib/telegram/notify");

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function getNextBuyPoint(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules
    .map((rule) => Math.abs(parsePercentValue(rule)))
    .filter(Number.isFinite);

  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) return null;

  let targetIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (targetIndex === -1) targetIndex = ruleDepths.length - 1;

  const previousDepth = targetIndex === 0 ? 0 : ruleDepths[targetIndex - 1];
  const targetDepth = ruleDepths[targetIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const rawProgress = ((currentDepth - previousDepth) / range) * 100;
  const progress = currentDepth >= targetDepth ? 100 : Math.min(100, Math.max(0, rawProgress));
  const remaining = Math.max(0, targetDepth - currentDepth);

  return {
    currentDepth,
    targetDepth,
    remaining,
    progress,
    targetAmount: amounts[targetIndex] || 0,
    level: targetIndex + 1,
  };
}

function getAlertLabel(remaining) {
  if (remaining <= 1) return "🟢 即將觸發";
  if (remaining <= 5) return "🟡 接近買點";
  return "⚪ 觀察";
}

function buildAlertRows(assets) {
  return (assets || [])
    .map((asset) => {
      const next = getNextBuyPoint(asset);
      if (!next) return null;
      return {
        symbol: asset.symbol,
        name: asset.name,
        price: asset.price,
        discount: asset.discount,
        ...next,
        label: getAlertLabel(next.remaining),
      };
    })
    .filter(Boolean)
    .filter((row) => row.remaining <= 5)
    .sort((a, b) => a.remaining - b.remaining);
}

function formatMessage(rows, updatedAt) {
  if (!rows.length) {
    return [
      "🔔 DCA折價獵人",
      "",
      "目前無即將觸發買點。",
      `檢查時間：${new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    ].join("\n");
  }

  const lines = [
    "🚨 DCA折價獵人 買點警報",
    "",
    `警報數量：${rows.length}`,
    `檢查時間：${new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    "",
  ];

  rows.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.label} ${row.symbol}`);
    lines.push(`目前深度：${row.currentDepth.toFixed(1)}%`);
    lines.push(`下一層：${row.targetDepth.toFixed(1)}%`);
    lines.push(`還差：${row.remaining.toFixed(1)}%`);
    lines.push(`進度：${row.progress.toFixed(0)}%`);
    lines.push(`建議：${row.targetAmount}U`);
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
    const pricesRes = await fetch(`${protocol}://${host}/api/prices?t=${Date.now()}`, { cache: "no-store" });
    const prices = await pricesRes.json();

    if (!pricesRes.ok) {
      const message = [
        "🔴 DCA折價獵人 API異常",
        "",
        "行情資料讀取失敗。",
        `錯誤：${prices.message || prices.error || pricesRes.status}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message);
      return res.status(500).json({ ok: false, alertType: "api_error", telegram: sent });
    }

    const rows = buildAlertRows(prices.data || []);
    const message = formatMessage(rows, prices.updatedAt);
    const sent = await sendTelegramMessage(message);

    if (!sent.ok) {
      return res.status(500).json({ ok: false, alertCount: rows.length, telegram: sent });
    }

    return res.status(200).json({ ok: true, sent: true, alertCount: rows.length, alerts: rows.map((row) => ({ symbol: row.symbol, remaining: row.remaining, progress: row.progress })) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Telegram alert failed" });
  }
}

module.exports = handler;
