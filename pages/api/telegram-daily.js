const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  if (value === null || value === undefined) return "N/A";
  const n = num(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
function signedMoney(value) {
  if (value === null || value === undefined) return "N/A";
  const n = num(value);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function signedPct(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function twTime() {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}
function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function signalLine(row) {
  if (row.reached) {
    return `${row.symbol}｜${row.tier}｜已達 ${row.targetDepth.toFixed(0)}%｜進度 ${row.progress.toFixed(0)}%｜建議 ${row.amount}U`;
  }
  return `${row.symbol}｜${row.tier}｜還差 ${row.remaining.toFixed(1)}%｜進度 ${row.progress.toFixed(0)}%｜建議 ${row.amount}U`;
}
function buildMessage(truth) {
  const s = truth.summary || {};
  const cash = truth.cash || {};
  const signals = truth.signals || { reached: [], near: [] };
  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${twTime()}`,
    "",
    `監控清單：${truth.monitorCount || 0} 檔`,
    `策略持倉數：${s.holdingCount ?? "—"} 檔`,
    `資料狀態：${s.costReady ? "正常" : `缺成本：${(s.missingSymbols || []).join("、") || "unknown"}`}`,
    "",
    `總投入：${money(s.totalCost)}`,
    `目前市值：${money(s.currentValue)}`,
    `未實現損益：${signedMoney(s.pnl)}`,
    `報酬率：${signedPct(s.pnlPct)}`,
    "",
    `現金檢查：可用 USDT ${num(cash.totalUSDT).toFixed(2)}U`,
    `Wallet USDT：${num(cash.walletUSDT).toFixed(2)}U｜Exchange USDT：${num(cash.exchangeUSDT).toFixed(2)}U`,
    `本月預算：3000 TWD｜固定DCA 1500｜逢低 1500`,
    "",
  ];

  if ((signals.reached || []).length > 0) {
    lines.push(`🔔 買點警報：已達 D 層 ${(signals.reached || []).length} 檔`);
    (signals.reached || []).forEach((row) => lines.push(signalLine(row)));
    lines.push("");
  }
  if ((signals.near || []).length > 0) {
    lines.push(`🔔 買點警報：接近下一個 D 層 ${(signals.near || []).length} 檔`);
    (signals.near || []).forEach((row) => lines.push(signalLine(row)));
    lines.push("");
  }
  if (!(signals.reached || []).length && !(signals.near || []).length) {
    lines.push("🔔 買點警報：今日無持倉達標，也無持倉接近下一個 D 層");
    lines.push("");
  }

  lines.push("Wallet：Portfolio Truth 鏡像資料");
  lines.push("Telegram 僅推播，不另行計算總投入/市值/持倉數。");
  return lines.join("\n").trim();
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const base = baseUrlFromReq(req);
    const truthRes = await fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" });
    const truth = await readJsonSafe(truthRes);
    if (!truthRes.ok || truth?.ok === false) {
      const message = [
        "🔴 DCA折價獵人日報失敗",
        "",
        `Portfolio Truth：${truth.message || truth.error || truthRes.status}`,
      ].join("\n");
      const shouldSendError = req.method === "POST" || String(req.query.send || "") === "1";
      const telegram = shouldSendError ? await sendTelegramMessage(message, { cooldownKey: "telegram-daily:error", cooldownHours: 12 }) : null;
      return res.status(500).json({ ok: false, sent: Boolean(telegram && !telegram.skipped), previewOnly: !shouldSendError, telegram, message });
    }

    const message = buildMessage(truth);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const force = String(req.query.force || "") === "1";
    const telegramOptions = force ? {} : { cooldownKey: "telegram-daily:daily-report", cooldownHours: 20 };
    const telegram = shouldSend ? await sendTelegramMessage(message, telegramOptions) : null;

    if (telegram && !telegram.ok) return res.status(500).json({ ok: false, telegram });

    return res.status(200).json({
      ok: true,
      version: "telegram-daily-mirror-v1",
      sourcePolicy: "portfolio-truth-mirror",
      sent: Boolean(telegram && !telegram.skipped),
      deduped: Boolean(telegram?.deduped),
      previewOnly: !shouldSend,
      force,
      alertCount: (truth.signals?.reached || []).length,
      nearCount: (truth.signals?.near || []).length,
      totals: truth.summary,
      cash: truth.cash,
      signals: truth.signals,
      monitorCount: truth.monitorCount,
      telegram,
      message,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
