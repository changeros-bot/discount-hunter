const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function holdingValue(holding) {
  return num(holding?.currentValue ?? holding?.marketValue ?? holding?.positionValue ?? holding?.rawCurrentValue ?? holding?.value);
}

function hasRealCost(holding) {
  const cost = num(holding?.totalCost ?? holding?.cost ?? holding?.costBasis);
  if (!(cost > 0)) return false;
  if (holding?.costBasisMissing) return false;
  const source = String(holding?.costBasisSource || "");
  return source.includes("transfer_history")
    || source.includes("binance_myTrades")
    || source.includes("verified_tx_hash_receipt")
    || source.includes("raw_buy_ledger")
    || source === "";
}

function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = String(holding?.symbol || "").trim().toUpperCase();
      if (!symbol || num(holding?.quantity) <= 0) continue;
      map.set(symbol, holding);
    }
  }
  return [...map.values()];
}

function walletTotals({ wallet, exchange }) {
  const holdings = mergeHoldingsBySymbol(wallet?.holdings || [], exchange?.holdings || []);
  const live = holdings.filter((h) => num(h.quantity) > 0);
  const known = live.filter(hasRealCost);
  const missing = live.filter((h) => !hasRealCost(h));
  const totalCost = known.reduce((sum, h) => sum + num(h.totalCost ?? h.cost ?? h.costBasis), 0);
  const currentValue = live.reduce((sum, h) => sum + holdingValue(h), 0);
  const costReady = live.length > 0 && missing.length === 0;
  const pnl = costReady ? currentValue - totalCost : null;
  const pnlPct = costReady && totalCost > 0 ? pnl / totalCost : null;
  return {
    holdings: live,
    knownCount: known.length,
    missingCount: missing.length,
    missingSymbols: missing.map((h) => String(h.symbol || "").toUpperCase()).filter(Boolean),
    totalCost: costReady ? totalCost : null,
    currentValue,
    pnl,
    pnlPct,
    costReady,
  };
}

function getNextBuyPoint(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);
  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) return null;

  let targetIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (targetIndex === -1) targetIndex = ruleDepths.length - 1;

  const previousDepth = targetIndex === 0 ? 0 : ruleDepths[targetIndex - 1];
  const targetDepth = ruleDepths[targetIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const reached = currentDepth >= targetDepth;
  const progress = reached ? 100 : Math.min(100, Math.max(0, ((currentDepth - previousDepth) / range) * 100));
  const remaining = Math.max(0, targetDepth - currentDepth);
  const model = asset.assetType === "crypto" || String(asset.symbol || "").toUpperCase() === "BTC"
    ? "Cycle High"
    : "52W High";

  return {
    currentDepth,
    targetDepth,
    remaining,
    progress,
    reached,
    targetAmount: amounts[targetIndex] || 0,
    model,
  };
}

function buildSignalRows(assets) {
  const rows = (assets || [])
    .map((asset) => {
      const next = getNextBuyPoint(asset);
      if (!next) return null;
      return { symbol: asset.symbol, name: asset.name, ...next };
    })
    .filter(Boolean);

  return {
    reached: rows.filter((row) => row.reached).sort((a, b) => b.targetDepth - a.targetDepth),
    near: rows.filter((row) => !row.reached && row.remaining <= 5).sort((a, b) => a.remaining - b.remaining),
  };
}

function formatMoney(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function formatSignedMoney(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}

function formatSignedPct(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function buildMessage({ wallet, exchange, prices }) {
  const totals = walletTotals({ wallet, exchange });
  const signals = buildSignalRows(prices?.data || []);
  const checkedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${checkedAt}`,
    "",
    `總成本：${formatMoney(totals.totalCost)}`,
    `目前市值：${formatMoney(totals.currentValue)}`,
    `未實現損益：${formatSignedMoney(totals.pnl)}`,
    `報酬率：${formatSignedPct(totals.pnlPct)}`,
    `持倉數：${totals.holdings.length}`,
    `成本狀態：已取得 ${totals.knownCount}｜缺成本 ${totals.missingCount}`,
    "",
  ];

  if (signals.reached.length > 0) {
    lines.push(`🟢 已達買點：${signals.reached.length} 檔`);
    signals.reached.forEach((row) => {
      lines.push(`${row.symbol}｜${row.model}｜D${row.targetDepth}%｜進度 ${row.progress.toFixed(0)}%｜建議 ${row.targetAmount}U`);
    });
    lines.push("");
  }

  if (signals.near.length > 0) {
    lines.push(`🟡 接近買點：${signals.near.length} 檔`);
    signals.near.forEach((row) => {
      lines.push(`${row.symbol}｜${row.model}｜還差 ${row.remaining.toFixed(1)}%｜進度 ${row.progress.toFixed(0)}%｜暫不買`);
    });
  } else if (signals.reached.length === 0) {
    lines.push("🔔 今日無達標買點，也無接近買點");
  }

  lines.push("");
  if (totals.costReady) {
    lines.push(`Wallet：${totals.holdings.length} 檔持倉資料正常`);
  } else {
    lines.push(`Wallet：${totals.holdings.length} 檔持倉；缺成本：${totals.missingSymbols.join("、") || "unknown"}`);
  }

  return { message: lines.join("\n"), alertCount: signals.reached.length, nearCount: signals.near.length, totals, signals };
}

async function readJsonSafe(response) {
  return response.json().catch(() => ({}));
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;

    const [walletRes, exchangeRes, pricesRes] = await Promise.all([
      fetch(`${base}/api/sync-wallet?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      }),
      fetch(`${base}/api/binance-exchange-position?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
    ]);

    const wallet = await readJsonSafe(walletRes);
    const exchange = await readJsonSafe(exchangeRes);
    const prices = await readJsonSafe(pricesRes);

    if (!walletRes.ok || !pricesRes.ok || wallet?.ok === false || prices?.ok === false) {
      const message = [
        "🔴 DCA折價獵人日報失敗",
        "",
        `Wallet：${wallet.message || wallet.error || walletRes.status}`,
        `Prices：${prices.message || prices.error || pricesRes.status}`,
      ].join("\n");
      const shouldSendError = req.method === "POST" || String(req.query.send || "") === "1";
      const telegram = shouldSendError ? await sendTelegramMessage(message, { cooldownKey: "telegram-daily:error", cooldownHours: 12 }) : null;
      return res.status(500).json({ ok: false, sent: Boolean(telegram && !telegram.skipped), previewOnly: !shouldSendError, telegram, message });
    }

    const daily = buildMessage({ wallet, exchange, prices });
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const telegram = shouldSend ? await sendTelegramMessage(daily.message, { cooldownKey: "telegram-daily:daily-report", cooldownHours: 20 }) : null;

    if (telegram && !telegram.ok) {
      return res.status(500).json({ ok: false, telegram });
    }

    return res.status(200).json({
      ok: true,
      sent: Boolean(telegram && !telegram.skipped),
      deduped: Boolean(telegram?.deduped),
      previewOnly: !shouldSend,
      alertCount: daily.alertCount,
      nearCount: daily.nearCount,
      totals: daily.totals,
      signals: daily.signals,
      exchangeConfigured: Boolean(exchange?.configured),
      telegram,
      message: daily.message,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
