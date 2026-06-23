const { sendTelegramMessage } = require("../../lib/telegram/notify");

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function isLiveHolding(holding) {
  return !!holding && holding.quantitySource === "bsc_rpc_balanceOf_live" && safeNumber(holding.quantity) > 0;
}

function getLayerEmoji(level) {
  if (level <= 1) return "🟢";
  if (level === 2) return "🟡";
  return "🔴";
}

function getLayerLabel(level, type) {
  const emoji = getLayerEmoji(level);
  const levelText = `第${level}層`;
  return type === "triggered" ? `${emoji} 已觸發${levelText}` : `${emoji} 接近${levelText}`;
}

function getCompletedLevel(asset, holding) {
  if (!isLiveHolding(holding)) return 0;

  const amounts = (asset.amounts || []).map(safeNumber);
  const totalCost = safeNumber(holding.totalCost);

  let completed = 1;
  let cumulative = 0;
  for (let i = 0; i < amounts.length; i += 1) {
    cumulative += amounts[i];
    if (totalCost + 0.000001 >= cumulative) completed = i + 1;
  }

  return Math.min(completed, amounts.length);
}

function buildHoldingMap(holdings) {
  const map = new Map();
  for (const holding of holdings || []) {
    if (!isLiveHolding(holding)) continue;
    map.set(normalizeSymbol(holding.symbol), holding);
  }
  return map;
}

function getNextActionPoint(asset, completedLevel = 0) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);

  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) return null;
  if (completedLevel >= ruleDepths.length) return null;

  const targetIndex = Math.max(0, completedLevel);
  const targetDepth = ruleDepths[targetIndex];
  const targetAmount = safeNumber(amounts[targetIndex]);
  const remaining = Math.max(0, targetDepth - currentDepth);
  const rawProgress = targetDepth > 0 ? Math.min(100, Math.max(0, (currentDepth / targetDepth) * 100)) : 0;
  const level = targetIndex + 1;

  if (currentDepth >= targetDepth) {
    return {
      type: "triggered",
      currentDepth,
      targetDepth,
      remaining: 0,
      progress: 100,
      displayProgress: 100,
      targetAmount,
      level,
      completedLevel,
      label: getLayerLabel(level, "triggered"),
    };
  }

  return {
    type: "near",
    currentDepth,
    targetDepth,
    remaining,
    progress: rawProgress,
    displayProgress: Math.min(99, Math.floor(rawProgress)),
    targetAmount,
    level,
    completedLevel,
    label: getLayerLabel(level, "near"),
  };
}

function buildAlertRows(assets, holdings) {
  const holdingMap = buildHoldingMap(holdings);

  return (assets || [])
    .map((asset) => {
      const holding = holdingMap.get(normalizeSymbol(asset.symbol));
      const completedLevel = getCompletedLevel(asset, holding);
      const point = getNextActionPoint(asset, completedLevel);
      if (!point) return null;
      return {
        symbol: asset.symbol,
        name: asset.name,
        price: asset.price,
        discount: asset.discount,
        hasLiveHolding: isLiveHolding(holding),
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
      "目前無已觸發或即將觸發的下一層買點。",
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
    const progressForDisplay = row.displayProgress ?? row.progress;
    lines.push(`${index + 1}. ${row.label} ${row.symbol}`);
    lines.push(`目前深度：${row.currentDepth.toFixed(1)}%`);
    lines.push(`目標層級：第${row.level}層`);
    if (row.completedLevel > 0) lines.push(`已完成：第${row.completedLevel}層`);
    lines.push(`門檻：-${row.targetDepth.toFixed(1)}%`);
    if (row.type === "near") lines.push(`還差：${row.remaining.toFixed(1)}%`);
    lines.push(`進度：${Number(progressForDisplay).toFixed(0)}%`);
    lines.push(`本層建議：${row.targetAmount}U`);
    lines.push("");
  });

  return lines.join("\n");
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const [pricesRes, walletRes] = await Promise.all([
      fetch(`${protocol}://${host}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store" }),
    ]);

    const prices = await readJson(pricesRes);
    const wallet = await readJson(walletRes);

    if (!pricesRes.ok) {
      const message = [
        "🔴 DCA折價獵人 API異常",
        "",
        "行情資料讀取失敗。",
        `錯誤：${prices?.message || prices?.error || pricesRes.status}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message);
      return res.status(500).json({ ok: false, alertType: "api_error", telegram: sent });
    }

    const walletOk = walletRes.ok && wallet?.ok;
    const holdings = walletOk ? wallet.holdings || [] : [];
    const rows = buildAlertRows(prices?.data || [], holdings);

    const message = walletOk
      ? formatMessage(rows, prices?.updatedAt)
      : [
          "⚠️ DCA折價獵人 Wallet讀取異常",
          "",
          "本次無法確認已完成買點層級，為避免重複警報，本次不發買點清單。",
          `錯誤：${wallet?.error || walletRes.status}`,
          `檢查時間：${new Date(prices?.updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
        ].join("\n");

    const sent = await sendTelegramMessage(message);

    if (!sent.ok) {
      return res.status(500).json({ ok: false, alertCount: rows.length, telegram: sent });
    }

    return res.status(200).json({
      ok: true,
      version: "15.37-telegram-progress-guard",
      sent: true,
      walletOk,
      alertCount: walletOk ? rows.length : 0,
      alerts: rows.map((row) => ({
        symbol: row.symbol,
        type: row.type,
        level: row.level,
        completedLevel: row.completedLevel,
        targetAmount: row.targetAmount,
        remaining: row.remaining,
        progress: row.progress,
        displayProgress: row.displayProgress,
        label: row.label,
        hasLiveHolding: row.hasLiveHolding,
      })),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Telegram alert failed" });
  }
}

module.exports = handler;
