const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pct(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  const n = num(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function getBuyRows(prices) {
  return (prices?.data || [])
    .map((asset) => {
      const depth = Math.abs(pct(asset.discount));
      const rules = asset.rules || [];
      const amounts = asset.amounts || [];
      const levels = rules.map((rule) => Math.abs(pct(rule))).filter((x) => Number.isFinite(x));
      if (!Number.isFinite(depth) || levels.length === 0) return null;

      let index = levels.findIndex((level) => depth < level);
      if (index === -1) index = levels.length - 1;

      const previous = index === 0 ? 0 : levels[index - 1];
      const target = levels[index];
      const range = Math.max(1, target - previous);
      const remaining = Math.max(0, target - depth);
      const progress = depth >= target ? 100 : Math.min(100, Math.max(0, ((depth - previous) / range) * 100));
      const label = remaining <= 1 ? "🟢" : remaining <= 5 ? "🟡" : "⚪";

      return {
        symbol: asset.symbol,
        depth,
        target,
        remaining,
        progress,
        amount: amounts[index] || 0,
        label,
      };
    })
    .filter(Boolean)
    .filter((row) => row.remaining <= 5)
    .sort((a, b) => a.remaining - b.remaining);
}

function getWalletTotals(wallet) {
  const holdings = wallet?.holdings || [];
  const totalCost = holdings.reduce((sum, item) => sum + num(item.totalCost ?? item.cost ?? item.costBasis), 0);
  const currentValue = holdings.reduce((sum, item) => sum + num(item.currentValue ?? item.value ?? item.marketValue), 0);
  const pnl = currentValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return { holdings, totalCost, currentValue, pnl, pnlPct };
}

function buildDailyMessage(wallet, prices) {
  const totals = getWalletTotals(wallet);
  const buys = getBuyRows(prices);
  const holdingsCount = wallet?.debugCounts?.holdingsCount ?? totals.holdings.length;
  const time = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${time}`,
    "",
    `總投入：${money(totals.totalCost)}`,
    `目前市值：${money(totals.currentValue)}`,
    `未實現損益：${money(totals.pnl)}`,
    `報酬率：${totals.pnlPct.toFixed(2)}%`,
    `持倉數：${holdingsCount}`,
    "",
  ];

  if (buys.length) {
    lines.push(`🔔 買點警報：${buys.length} 檔`);
    buys.forEach((row) => {
      lines.push(`${row.label} ${row.symbol}｜還差 ${row.remaining.toFixed(1)}%｜進度 ${row.progress.toFixed(0)}%｜建議 ${row.amount}U`);
    });
  } else {
    lines.push("🔔 買點警報：目前無即將觸發買點");
  }

  lines.push("");
  lines.push(`Wallet：${holdingsCount} 檔持倉資料正常`);
  return { message: lines.join("\n"), buyCount: buys.length, totals, holdingsCount };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
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

    const wallet = await walletRes.json();
    const prices = await pricesRes.json();

    if (!walletRes.ok || !pricesRes.ok) {
      const message = [
        "🔴 DCA折價獵人日報失敗",
        "",
        `Wallet：${wallet.message || wallet.error || walletRes.status}`,
        `Prices：${prices.message || prices.error || pricesRes.status}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message);
      return res.status(500).json({ ok: false, sent });
    }

    const daily = buildDailyMessage(wallet, prices);
    const sent = await sendTelegramMessage(daily.message);

    if (!sent.ok) {
      return res.status(500).json({ ok: false, telegram: sent });
    }

    return res.status(200).json({ ok: true, sent: true, buyCount: daily.buyCount, holdingsCount: daily.holdingsCount, totals: daily.totals });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "daily summary failed" });
  }
}

module.exports = handler;
