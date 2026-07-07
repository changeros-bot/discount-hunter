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

function isCryptoAsset(asset) {
  return asset?.assetType === "crypto" || String(asset?.symbol || "").toUpperCase() === "BTC";
}

function assetModel(asset) {
  return isCryptoAsset(asset) ? "BTC Cycle High" : "52W High";
}

function getSignalRows(prices) {
  const rows = (prices?.data || [])
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
      const reached = depth >= target;
      const remaining = Math.max(0, target - depth);
      const progress = reached ? 100 : Math.min(100, Math.max(0, ((depth - previous) / range) * 100));

      return {
        symbol: asset.symbol,
        assetType: isCryptoAsset(asset) ? "BTC" : "xStock",
        model: assetModel(asset),
        depth,
        target,
        remaining,
        progress,
        reached,
        amount: amounts[index] || 0,
      };
    })
    .filter(Boolean);

  return {
    reached: rows.filter((row) => row.reached).sort((a, b) => b.target - a.target),
    near: rows.filter((row) => !row.reached && row.remaining <= 5).sort((a, b) => a.remaining - b.remaining),
  };
}

function getWalletTotals(wallet) {
  const holdings = wallet?.holdings || [];
  const totalCost = holdings.reduce((sum, item) => sum + num(item.totalCost ?? item.cost ?? item.costBasis), 0);
  const currentValue = holdings.reduce((sum, item) => sum + num(item.currentValue ?? item.value ?? item.marketValue), 0);
  const pnl = currentValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return { holdings, totalCost, currentValue, pnl, pnlPct };
}

function getMonitorSummary(wallet, prices) {
  const data = prices?.data || [];
  const monitorCount = Number(prices?.count) || data.length;
  const cryptoCount = data.filter(isCryptoAsset).length;
  const xstockMonitorCount = Math.max(0, monitorCount - cryptoCount);
  const walletHoldingsCount = wallet?.debugCounts?.holdingsCount ?? wallet?.holdings?.length ?? 0;
  const costMissingCount = wallet?.debugCounts?.costBasisMissingCount ?? 0;
  const costMissingSymbols = wallet?.debugCounts?.costBasisMissingSymbols || [];
  return { monitorCount, cryptoCount, xstockMonitorCount, walletHoldingsCount, costMissingCount, costMissingSymbols };
}

function buildDailyMessage(wallet, prices) {
  const totals = getWalletTotals(wallet);
  const signals = getSignalRows(prices);
  const summary = getMonitorSummary(wallet, prices);
  const time = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const lines = [
    "📊 DCA折價獵人日報",
    "",
    `時間：${time}`,
    "",
    `監控清單：${summary.monitorCount} 檔（BTC + xStocks）｜Wallet：${summary.walletHoldingsCount}/${summary.xstockMonitorCount} 檔 xStocks`,
    "",
    `xStocks 總投入：${money(totals.totalCost)}`,
    `xStocks 目前市值：${money(totals.currentValue)}`,
    `xStocks 未實現損益：${money(totals.pnl)}`,
    `xStocks 報酬率：${totals.pnlPct.toFixed(2)}%`,
    "",
  ];

  if (signals.reached.length) {
    lines.push(`🟢 已達買點：${signals.reached.length} 檔`);
    signals.reached.forEach((row) => {
      lines.push(`${row.assetType === "BTC" ? "🟠" : "🟢"} ${row.symbol}｜${row.model}｜進度 ${row.progress.toFixed(0)}%`);
      lines.push(`訊號金額：${row.amount}U｜需 Josh 確認`);
    });
    lines.push("");
  }

  if (signals.near.length) {
    lines.push(`🟡 接近買點，僅觀察：${signals.near.length} 檔`);
    signals.near.forEach((row) => {
      lines.push(`${row.assetType === "BTC" ? "🟠" : "🟢"} ${row.symbol}｜還差 ${row.remaining.toFixed(1)}%｜進度 ${row.progress.toFixed(0)}%`);
      lines.push(`觸發後訊號金額：${row.amount}U｜目前暫不買`);
    });
  } else if (!signals.reached.length) {
    lines.push("🔔 今日無達標買點，也無接近買點");
  }

  lines.push("");
  lines.push("⚠️ 執行提醒：以上為買點訊號，不是強制買入。請確認現金、本月預算與單檔上限。");
  if (summary.costMissingCount > 0) {
    lines.push(`Wallet：讀取 ${summary.walletHoldingsCount}/${summary.xstockMonitorCount} 檔 xStocks；缺成本 ${summary.costMissingCount} 檔：${summary.costMissingSymbols.join("、") || "unknown"}`);
  } else {
    lines.push(`Wallet：已讀取 ${summary.walletHoldingsCount}/${summary.xstockMonitorCount} 檔 xStocks，資料正常`);
  }

  return {
    message: lines.join("\n"),
    buyCount: signals.reached.length,
    nearCount: signals.near.length,
    totals,
    monitorSummary: summary,
  };
}

async function readJsonSafe(response) {
  return response.json().catch(() => ({}));
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
      const telegram = shouldSendError ? await sendTelegramMessage(message, { cooldownKey: "daily-summary:error", cooldownHours: 12 }) : null;
      return res.status(500).json({ ok: false, sent: Boolean(telegram && !telegram.skipped), previewOnly: !shouldSendError, telegram, message });
    }

    const daily = buildDailyMessage(wallet, prices);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const telegram = shouldSend ? await sendTelegramMessage(daily.message, { cooldownKey: "daily-summary:daily-report", cooldownHours: 20 }) : null;

    if (telegram && !telegram.ok) {
      return res.status(500).json({ ok: false, telegram });
    }

    return res.status(200).json({
      ok: true,
      sent: Boolean(telegram && !telegram.skipped),
      deduped: Boolean(telegram?.deduped),
      previewOnly: !shouldSend,
      buyCount: daily.buyCount,
      nearCount: daily.nearCount,
      monitorSummary: daily.monitorSummary,
      totals: daily.totals,
      telegram,
      message: daily.message,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "daily summary failed" });
  }
}

module.exports = handler;
