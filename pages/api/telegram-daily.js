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
function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount,
  }]));
}
function decisionAmountText(row) {
  return row?.decision?.amountText || (row?.decision?.amount ? `${row.decision.amount}U` : row?.amountText || "--");
}
function decisionLine(row) {
  const symbol = row?.symbol || "—";
  const tier = row?.decision?.tier || row?.tier || row?.signalTier || "D?";
  const progress = Number(row?.progressPct ?? row?.progress ?? row?.decision?.progress);
  const discount = row?.discountText || row?.discount || row?.decision?.discount;
  const parts = [`${symbol}`, `${tier}`];
  if (discount !== undefined && discount !== null && discount !== "") parts.push(`回撤 ${discount}`);
  if (Number.isFinite(progress)) parts.push(`進度 ${progress.toFixed(0)}%`);
  parts.push(`建議 ${decisionAmountText(row)}`);
  return parts.join("｜");
}
function buildMessage(truth, todayDecision) {
  const s = truth.summary || {};
  const cash = truth.cash || {};
  const decisionRows = Array.isArray(todayDecision?.cards) ? todayDecision.cards : [];
  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${twTime()}`,
    "",
    `掃描清單：${truth.monitorCount || 0} 檔`,
    `買點區持倉：${decisionRows.length} 檔`,
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

  if (decisionRows.length > 0) {
    lines.push(`🧭 今日決策：買點區 ${decisionRows.length} 檔`);
    decisionRows.forEach((row) => lines.push(decisionLine(row)));
    lines.push("");
  } else {
    lines.push("🧭 今日決策：目前無持倉進入買點區");
    lines.push("");
  }

  lines.push("資料來源：Portfolio Truth + App 今日決策鏡像");
  lines.push("Telegram 僅推播，不另行計算總投入/市值/持倉數。觀察區不列入買點區持倉。");
  return lines.join("\n").trim();
}

async function fetchTodayDecision(base) {
  const pricesRes = await fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" });
  const prices = await readJsonSafe(pricesRes);
  if (!pricesRes.ok || prices?.ok === false) throw new Error(prices?.error || `prices ${pricesRes.status}`);
  const rows = Array.isArray(prices.data) ? prices.data : [];
  const decisionRes = await fetch(`${base}/api/v17/ui-decisions?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: false }),
    cache: "no-store",
  });
  const decision = await readJsonSafe(decisionRes);
  if (!decisionRes.ok || decision?.ok === false) throw new Error(decision?.error || `ui-decisions ${decisionRes.status}`);
  return decision;
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const base = baseUrlFromReq(req);
    const [truthRes, todayDecision] = await Promise.all([
      fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" }),
      fetchTodayDecision(base),
    ]);
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

    const message = buildMessage(truth, todayDecision);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const force = String(req.query.force || "") === "1";
    const telegramOptions = force ? {} : { cooldownKey: "telegram-daily:daily-report", cooldownHours: 20 };
    const telegram = shouldSend ? await sendTelegramMessage(message, telegramOptions) : null;

    if (telegram && !telegram.ok) return res.status(500).json({ ok: false, telegram });

    return res.status(200).json({
      ok: true,
      version: "telegram-daily-app-decision-mirror-v2",
      sourcePolicy: "portfolio-truth-plus-app-today-decision-mirror",
      sent: Boolean(telegram && !telegram.skipped),
      deduped: Boolean(telegram?.deduped),
      previewOnly: !shouldSend,
      force,
      decisionCount: Array.isArray(todayDecision?.cards) ? todayDecision.cards.length : 0,
      totals: truth.summary,
      cash: truth.cash,
      todayDecision,
      monitorCount: truth.monitorCount,
      telegram,
      message,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
