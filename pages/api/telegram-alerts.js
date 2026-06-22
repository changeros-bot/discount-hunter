const { sendTelegramMessage } = require("../../lib/telegram/notify");

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getTriggeredBuyPoint(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);

  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) return null;

  let triggeredIndex = -1;
  for (let i = 0; i < ruleDepths.length; i += 1) {
    if (currentDepth >= ruleDepths[i]) triggeredIndex = i;
  }

  if (triggeredIndex >= 0) {
    return {
      type: "triggered",
      currentDepth,
      targetDepth: ruleDepths[triggeredIndex],
      remaining: 0,
      progress: 100,
      targetAmount: safeNumber(amounts[triggeredIndex]),
      level: triggeredIndex + 1,
      label: "🚨 已觸發買點",
    };
  }

  const nextIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (nextIndex < 0) return null;

  const previousDepth = nextIndex === 0 ? 0 : ruleDepths[nextIndex - 1];
  const targetDepth = ruleDepths[nextIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const rawProgress = ((currentDepth - previousDepth) / range) * 100;
  const progress = Math.min(100, Math.max(0, rawProgress));
  const remaining = Math.max(0, targetDepth - currentDepth);

  return {
    type: "near",
    currentDepth,
    targetDepth,
    remaining,
    progress,
    targetAmount: safeNumber(amounts[nextIndex]),
    level: nextIndex + 1,
    label: remaining <= 1 ? "🟢 即將觸發" : "🟡 接近買點",
  };
}

function buildAlertRows(assets) {
  return (assets || [])
    .map((asset) => {
      const point = getTriggeredBuyPoint(asset);
      if (!point) return null;
      return {
        symbol: asset.symbol,
        name: asset.name,
        price: asset.price,
        discount: asset.discount,
        ...point,
      };
    })
    .filter(Boolean)
    .filter((row) => row.type === "triggered" || row.remaining <= 5)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "triggered" ? -1 : 1;
      if (a.level !== b.level) return b.level - a.level;
      return a.remaining - b.remaining;
    });
}

function formatMessage(rows, updatedAt) {
  if (!rows.length) {
    return [
      "🔔 DCA折價獵人",
      "",
      "目前無已觸發或即將觸發買點。",
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
    lines.push(`觸發層級：第${row.level}層`);
    lines.push(`門檻：-${row.targetDepth.toFixed(1)}%`);
    if (row.type === "near") lines.push(`還差：${row.remaining.toFixed(1)}%`);
    lines.push(`進度：${row.progress.toFixed(0)}%`);
    lines.push(`本層建議：${row.targetAmount}U`);
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

    return res.status(200).json({
      ok: true,
      version: "15.13-triggered-buy-alerts",
      sent: true,
      alertCount: rows.length,
      alerts: rows.map((row) => ({ symbol: row.symbol, type: row.type, level: row.level, targetAmount: row.targetAmount, remaining: row.remaining, progress: row.progress })),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Telegram alert failed" });
  }
}

module.exports = handler;
