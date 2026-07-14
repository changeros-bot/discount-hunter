const { sendTelegramMessage } = require("../../lib/telegram/notify");

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value, currency) {
  const prefix = currency === "TWD" ? "NT$" : "US$";
  return `${prefix}${num(value).toFixed(2)}`;
}

function targetPrice(high52w, rule) {
  return Number((num(high52w) * (1 + num(rule) / 100)).toFixed(2));
}

function row(asset) {
  const active = Number(asset?.level?.active || 0);
  const nextRule = asset?.level?.nextRule;
  const nextPrice = nextRule == null ? null : targetPrice(asset.high52w, nextRule);
  const lines = [
    `${asset.symbol}｜${money(asset.price, asset.currency)}｜回撤 ${num(asset.discount).toFixed(2)}%｜${active > 0 ? `L${active}` : "尚未到買點"}`,
    `52週高點：${money(asset.high52w, asset.currency)}`,
  ];

  if (nextRule != null) {
    lines.push(`下一層：${nextRule}%｜價格 ≤ ${money(nextPrice, asset.currency)}｜加碼 ${money(asset.level.nextAmount, asset.currency)}`);
  } else {
    lines.push("下一層：已達最深層");
  }

  if (asset.holding?.shares > 0) {
    lines.push(`持有：${asset.holding.shares} 股｜成本 ${money(asset.holding.cost, asset.currency)}`);
    lines.push(`富邦帳面：${money(asset.holding.brokerPnl, asset.currency)}（${num(asset.holding.brokerPnlPct).toFixed(2)}%）`);
    lines.push(`市場估算：${money(asset.liveHolding?.pnl, asset.currency)}（${num(asset.liveHolding?.pnlPct).toFixed(2)}%）`);
  } else {
    lines.push("持有：尚未持有");
  }

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
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;
    const quoteRes = await fetch(`${base}/api/fubon-quotes?t=${Date.now()}`, { cache: "no-store" });
    const payload = await readJson(quoteRes);

    if (!quoteRes.ok || !payload?.ok) {
      return res.status(500).json({ ok: false, error: payload?.error || `fubon_quotes_http_${quoteRes.status}` });
    }

    const dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const message = [
      "☀️ 富邦長期 DCA 每日晨報",
      "",
      ...payload.quotes.flatMap((asset, index) => [row(asset), index < payload.quotes.length - 1 ? "" : null]).filter(Boolean),
      "",
      "資料說明：富邦帳面資料來自你最後提供的 App 截圖；市場價格、52 週高點、回撤、買點及市場估算來自公開行情。兩者可能因報價時間、帳務價、匯率與費用計算不同而不一致。",
      "",
      `更新時間：${new Date(payload.checkedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
      "固定 DCA 不因買點與否而中斷；所有加碼仍需手動確認。",
    ].join("\n");

    const sent = await sendTelegramMessage(message, {
      cooldownKey: `fubon-dca-daily:${dateKey}`,
      cooldownHours: 23,
    });

    return res.status(sent.ok ? 200 : 500).json({
      ok: sent.ok,
      service: "fubon-dca-telegram-daily",
      sent: sent.ok && !sent.skipped,
      skipped: Boolean(sent.skipped),
      dateKey,
      checkedAt: payload.checkedAt,
      telegram: sent,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "fubon_daily_failed" });
  }
}

module.exports = handler;
