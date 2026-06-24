const { sendTelegramMessage } = require("../../lib/telegram/notify");

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isLiveHolding(holding) {
  return holding && holding.quantitySource === "bsc_rpc_balanceOf_live" && n(holding.quantity) > 0;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function symbolOf(value) {
  return String(value || "").trim().toUpperCase().replace(/ON$/, "") + "on";
}

function fmtUsd(value) {
  const number = n(value);
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${Math.abs(number).toFixed(2)}U`;
}

function fmtPct(value) {
  const number = n(value);
  const sign = number > 0 ? "+" : number < 0 ? "" : "";
  return `${sign}${number.toFixed(2)}%`;
}

function buildReport(wallet) {
  const holdings = (wallet.holdings || []).filter(isLiveHolding);
  const totalCost = holdings.reduce((sum, h) => sum + n(h.totalCost), 0);
  const marketValue = holdings.reduce((sum, h) => sum + n(h.currentValue), 0);
  const pnl = marketValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const details = holdings.map((h) => {
    const cost = n(h.totalCost);
    const value = n(h.currentValue);
    const itemPnl = value - cost;
    const itemPct = cost > 0 ? (itemPnl / cost) * 100 : 0;
    return {
      symbol: symbolOf(h.symbol),
      quantity: n(h.quantity),
      cost,
      marketValue: value,
      pnl: itemPnl,
      pnlPct: itemPct,
    };
  }).sort((a, b) => b.marketValue - a.marketValue);

  return { totalCost, marketValue, pnl, pnlPct, details };
}

function formatReport(report, checkedAt) {
  const lines = [
    "📊 DCA折價獵人 V16 每日持倉日報",
    "",
    `日期：${new Date(checkedAt || Date.now()).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    `總成本：${fmtUsd(report.totalCost).replace(/^\+/, "")}`,
    `持倉市值：${fmtUsd(report.marketValue).replace(/^\+/, "")}`,
    `未實現損益：${fmtUsd(report.pnl)}`,
    `報酬率：${fmtPct(report.pnlPct)}`,
    "",
    "各標的明細：",
    "",
  ];

  if (!report.details.length) {
    lines.push("目前沒有鏈上持倉。");
    return lines.join("\n");
  }

  for (const item of report.details) {
    lines.push(item.symbol);
    lines.push(`成本：${fmtUsd(item.cost).replace(/^\+/, "")}`);
    lines.push(`市值：${fmtUsd(item.marketValue).replace(/^\+/, "")}`);
    lines.push(`未實現：${fmtUsd(item.pnl)}`);
    lines.push(`報酬率：${fmtPct(item.pnlPct)}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const walletRes = await fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store" });
    const wallet = await readJson(walletRes);

    if (!walletRes.ok || !wallet?.ok) {
      return res.status(502).json({ ok: false, error: wallet?.error || walletRes.status });
    }

    const report = buildReport(wallet);
    const text = formatReport(report, wallet.checkedAt);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const telegram = shouldSend ? await sendTelegramMessage(text) : null;

    return res.status(telegram && !telegram.ok ? 500 : 200).json({
      ok: telegram ? telegram.ok : true,
      version: "16.0-daily-position-report",
      sent: !!telegram,
      report,
      text,
      telegram,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "daily report failed" });
  }
}

module.exports = handler;
