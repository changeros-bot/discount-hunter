const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value, currency) {
  const n = num(value);
  const prefix = currency === "TWD" ? "NT$" : "US$";
  return `${prefix}${n.toFixed(2)}`;
}

function targetPrice(high52w, rule) {
  return Number((num(high52w) * (1 + num(rule) / 100)).toFixed(2));
}

function currentLevel(asset) {
  return Number(asset?.level?.active || 0);
}

function nextTarget(asset) {
  const rule = asset?.level?.nextRule;
  if (rule == null) return null;
  return {
    rule,
    price: targetPrice(asset.high52w, rule),
    amount: asset?.level?.nextAmount,
  };
}

function buildMessage(asset, previous, current, checkedAt) {
  const next = nextTarget(asset);
  const direction = current > previous ? "買點觸發" : "層級回升";
  const lines = [
    current > previous ? "🚨 富邦 DCA 買點警報" : "🔄 富邦 DCA 層級更新",
    "",
    `${asset.symbol}｜${direction}`,
    `目前價格：${money(asset.price, asset.currency)}`,
    `52 週高點：${money(asset.high52w, asset.currency)}`,
    `目前回撤：${num(asset.discount).toFixed(2)}%`,
    `層級：L${previous} → L${current}`,
  ];

  if (current > previous && current > 0) {
    lines.push(`本層加碼：${money(asset.level.buyAmount, asset.currency)}`);
  }

  if (next) {
    lines.push(`下一層：${next.rule}%`);
    lines.push(`下一層價格：≤ ${money(next.price, asset.currency)}`);
    lines.push(`下一層加碼：${money(next.amount, asset.currency)}`);
  } else {
    lines.push("已達最深層級");
  }

  if (asset.holding?.shares > 0) {
    lines.push("");
    lines.push(`富邦帳面損益：${money(asset.holding.brokerPnl, asset.currency)}（${num(asset.holding.brokerPnlPct).toFixed(2)}%）`);
    lines.push(`市場即時估算：${money(asset.liveHolding?.pnl, asset.currency)}（${num(asset.liveHolding?.pnlPct).toFixed(2)}%）`);
    lines.push("兩者可能因報價時間、帳務價、匯率與費用計算不同而不一致。");
  }

  lines.push("");
  lines.push(`檢查時間：${new Date(checkedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`);
  return lines.join("\n");
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { readAlerts, writeAlerts } = await import("../../lib/v16-ledger.js");
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;

    const [quoteRes, alerts] = await Promise.all([
      fetch(`${base}/api/fubon-quotes?t=${Date.now()}`, { cache: "no-store" }),
      readAlerts(),
    ]);

    const payload = await readJson(quoteRes);
    if (!quoteRes.ok || !payload?.ok) {
      return res.status(500).json({ ok: false, error: payload?.error || `fubon_quotes_http_${quoteRes.status}` });
    }

    const states = alerts.__fubonLayerState || {};
    const nextAlerts = {
      ...(alerts || {}),
      __fubonLayerState: { ...states },
    };

    const results = [];
    for (const asset of payload.quotes || []) {
      if (asset.status !== "LIVE") continue;
      const symbol = String(asset.symbol || "").trim();
      if (!symbol) continue;

      const exists = Object.prototype.hasOwnProperty.call(states, symbol);
      const previous = Number(states[symbol]?.currentLevel || 0);
      const current = currentLevel(asset);
      const changed = exists ? current !== previous : current > 0;

      if (changed) {
        const eventType = current > previous ? "trigger" : "recovery";
        const key = `fubon-dca:${symbol}:${eventType}:L${previous}:L${current}`;
        const sent = await sendTelegramMessage(
          buildMessage(asset, previous, current, payload.checkedAt),
          { cooldownKey: key, cooldownHours: 24 * 365 }
        );
        results.push({ symbol, previous, current, sent: sent.ok, skipped: Boolean(sent.skipped), key });
        if (!sent.ok) return res.status(500).json({ ok: false, failed: symbol, telegram: sent });
      }

      nextAlerts.__fubonLayerState[symbol] = {
        currentLevel: current,
        discount: asset.discount,
        high52w: asset.high52w,
        updatedAt: new Date().toISOString(),
      };
    }

    const storage = await writeAlerts(nextAlerts);
    return res.status(200).json({
      ok: true,
      service: "fubon-dca-telegram-alerts",
      sent: results.some((item) => item.sent && !item.skipped),
      eventCount: results.length,
      results,
      storage: storage.store,
      checkedAt: payload.checkedAt,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "fubon_telegram_alert_failed" });
  }
}

module.exports = handler;
