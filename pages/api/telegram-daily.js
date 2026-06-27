const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
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
  const progress = currentDepth >= targetDepth ? 100 : Math.min(100, Math.max(0, ((currentDepth - previousDepth) / range) * 100));
  const remaining = Math.max(0, targetDepth - currentDepth);

  return { currentDepth, targetDepth, remaining, progress, targetAmount: amounts[targetIndex] || 0 };
}

function buildAlertRows(assets) {
  return (assets || [])
    .map((asset) => {
      const next = getNextBuyPoint(asset);
      if (!next) return null;
      const label = next.remaining <= 1 ? "🟢" : next.remaining <= 5 ? "🟡" : "⚪";
      return { symbol: asset.symbol, ...next, label };
    })
    .filter(Boolean)
    .filter((row) => row.remaining <= 5)
    .sort((a, b) => a.remaining - b.remaining);
}

function walletTotals(wallet) {
  const holdings = wallet?.holdings || [];
  const totalCost = holdings.reduce((sum, h) => sum + num(h.totalCost ?? h.cost ?? h.costBasis), 0);
  const currentValue = holdings.reduce((sum, h) => sum + num(h.currentValue ?? h.value ?? h.marketValue), 0);
  const pnl = currentValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return { holdings, totalCost, currentValue, pnl, pnlPct };
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function buildMessage({ wallet, prices }) {
  const totals = walletTotals(wallet);
  const alerts = buildAlertRows(prices?.data || []);
  const checkedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const holdingsCount = wallet?.debugCounts?.holdingsCount ?? totals.holdings.length;

  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${checkedAt}`,
    "",
    `總投入：${formatMoney(totals.totalCost)}`,
    `目前市值：${formatMoney(totals.currentValue)}`,
    `未實現損益：${formatMoney(totals.pnl)}`,
    `報酬率：${totals.pnlPct.toFixed(2)}%`,
    `持倉數：${holdingsCount}`,
    "",
  ];

  if (alerts.length > 0) {
    lines.push(`🔔 買點警報：${alerts.length} 檔`);
    alerts.forEach((row) => {
      lines.push(`${row.label} ${row.symbol}｜還差 ${row.remaining.toFixed(1)}%｜進度 ${row.progress.toFixed(0)}%｜建議 ${row.targetAmount}U`);
    });
  } else {
    lines.push("🔔 買點警報：目前無即將觸發買點");
  }

  lines.push("");
  lines.push(`Wallet：${holdingsCount} 檔持倉資料正常`);

  return { message: lines.join("\n"), alertCount: alerts.length, totals };
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

    const [walletRes, pricesRes] = await Promise.all([
      fetch(`${base}/api/sync-wallet?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      }),
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
    ]);

    const wallet = await readJsonSafe(walletRes);
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

    const daily = buildMessage({ wallet, prices });
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
      totals: daily.totals,
      telegram,
      message: daily.message,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
