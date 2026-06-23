const { sendTelegramMessage } = require("../../lib/telegram/notify");
const { hasKvConfig, getJson, setJson } = require("../../lib/state/kv");

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function symbolOf(value) {
  return String(value || "").trim().toUpperCase().replace(/ON$/, "");
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

function buildSnapshot(holdings) {
  const snapshot = {};
  for (const holding of holdings || []) {
    if (!isLiveHolding(holding)) continue;
    const symbol = symbolOf(holding.symbol);
    snapshot[symbol] = {
      symbol,
      quantity: n(holding.quantity),
      totalCost: n(holding.totalCost),
      currentValue: n(holding.currentValue),
      tokenPrice: n(holding.tokenPrice),
      checkedAt: new Date().toISOString(),
    };
  }
  return snapshot;
}

function diffSnapshots(previousSnapshot, currentSnapshot) {
  const changes = [];
  const symbols = Array.from(new Set([
    ...Object.keys(previousSnapshot || {}),
    ...Object.keys(currentSnapshot || {}),
  ])).sort();

  for (const symbol of symbols) {
    const prev = previousSnapshot?.[symbol] || { quantity: 0, totalCost: 0, currentValue: 0 };
    const curr = currentSnapshot?.[symbol] || { quantity: 0, totalCost: 0, currentValue: 0, tokenPrice: 0 };
    const quantityDelta = n(curr.quantity) - n(prev.quantity);
    const costDelta = n(curr.totalCost) - n(prev.totalCost);

    if (Math.abs(quantityDelta) <= 1e-10 && Math.abs(costDelta) <= 0.01) continue;

    changes.push({
      symbol,
      direction: quantityDelta > 0 || costDelta > 0 ? "increase" : "decrease",
      quantityDelta,
      costDelta,
      previousQuantity: n(prev.quantity),
      currentQuantity: n(curr.quantity),
      previousTotalCost: n(prev.totalCost),
      currentTotalCost: n(curr.totalCost),
      currentValue: n(curr.currentValue),
      tokenPrice: n(curr.tokenPrice),
    });
  }

  return changes;
}

function formatMessage(changes, checkedAt) {
  const lines = [
    "✅ DCA折價獵人 持倉異動",
    "",
    `異動數量：${changes.length}`,
    `檢查時間：${new Date(checkedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    "",
  ];

  changes.forEach((change, index) => {
    const icon = change.direction === "increase" ? "🟢" : "🔻";
    const action = change.direction === "increase" ? "偵測到新增持倉" : "偵測到持倉減少";
    lines.push(`${index + 1}. ${icon} ${action} ${change.symbol}on`);
    lines.push(`數量變化：${change.quantityDelta > 0 ? "+" : ""}${change.quantityDelta.toFixed(8)}`);
    if (Math.abs(change.costDelta) > 0.01) lines.push(`成本變化：${change.costDelta > 0 ? "+" : ""}${change.costDelta.toFixed(2)}U`);
    lines.push(`目前數量：${change.currentQuantity.toFixed(8)}`);
    lines.push(`目前成本：${change.currentTotalCost.toFixed(2)}U`);
    if (change.currentValue > 0) lines.push(`目前市值：${change.currentValue.toFixed(2)}U`);
    lines.push("");
  });

  return lines.join("\n");
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!hasKvConfig()) {
      return res.status(200).json({
        ok: true,
        version: "15.39-wallet-change-alerts",
        enabled: false,
        reason: "missing_upstash_env",
        requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      });
    }

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const walletRes = await fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store" });
    const wallet = await readJson(walletRes);

    if (!walletRes.ok || !wallet?.ok) {
      return res.status(502).json({ ok: false, error: wallet?.error || walletRes.status });
    }

    const walletKey = String(wallet.fullWalletAddress || wallet.walletAddress || "default").toLowerCase();
    const key = `discount-hunter:wallet-snapshot:${walletKey}`;
    const currentSnapshot = buildSnapshot(wallet.holdings || []);
    const previous = await getJson(key);

    if (!previous.result) {
      await setJson(key, currentSnapshot);
      return res.status(200).json({
        ok: true,
        version: "15.39-wallet-change-alerts",
        enabled: true,
        baselineCreated: true,
        changeCount: 0,
        message: "Baseline created. Next wallet change will trigger Telegram.",
      });
    }

    const changes = diffSnapshots(previous.result, currentSnapshot);
    await setJson(key, currentSnapshot);

    if (!changes.length) {
      return res.status(200).json({
        ok: true,
        version: "15.39-wallet-change-alerts",
        enabled: true,
        baselineCreated: false,
        changeCount: 0,
        sent: false,
      });
    }

    const telegram = await sendTelegramMessage(formatMessage(changes, wallet.checkedAt));

    return res.status(telegram.ok ? 200 : 500).json({
      ok: telegram.ok,
      version: "15.39-wallet-change-alerts",
      enabled: true,
      baselineCreated: false,
      changeCount: changes.length,
      changes,
      telegram,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "wallet change alert failed" });
  }
}

module.exports = handler;
