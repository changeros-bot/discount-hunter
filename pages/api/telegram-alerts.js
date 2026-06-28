const { sendTelegramMessage } = require("../../lib/telegram/notify");

const NEAR_THRESHOLDS = [92, 94, 96, 98];
const MAX_LEVEL = 4;

function num(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function stripOn(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function tier(level) {
  return level > 0 ? `D${level}` : "D0";
}

function getLevel(asset) {
  const signal = Number(asset?.signal?.level || 0);
  if (signal > 0) return Math.min(MAX_LEVEL, signal);
  const depth = Math.abs(num(asset?.discount));
  const rules = (asset?.rules || []).map((rule) => Math.abs(num(rule)));
  let level = 0;
  for (let i = 0; i < rules.length; i += 1) if (depth >= rules[i]) level = i + 1;
  return Math.min(MAX_LEVEL, level);
}

function progressTo(asset, level) {
  const depth = Math.abs(num(asset?.discount));
  const target = Math.abs(num(asset?.rules?.[level - 1]));
  if (!target) return 0;
  return Math.max(0, Math.min(100, (depth / target) * 100));
}

function topThreshold(progress) {
  return NEAR_THRESHOLDS.filter((threshold) => progress >= threshold).pop() || null;
}

function highPrice(asset) {
  return num(asset?.high || asset?.high52w || asset?.high52Week || asset?.ath || asset?.allTimeHigh);
}

function ledgerKey(ledger, symbol) {
  const target = stripOn(symbol);
  return Object.keys(ledger || {}).find((key) => stripOn(key) === target) || symbol;
}

function hasLedgerTier(ledger, symbol, level) {
  if (level < 1) return false;
  const rows = ledger?.[ledgerKey(ledger, symbol)]?.[`D${level}`];
  return Array.isArray(rows) && rows.length > 0;
}

function doneLevel(ledger, symbol) {
  for (let level = MAX_LEVEL; level >= 1; level -= 1) if (hasLedgerTier(ledger, symbol, level)) return level;
  return 0;
}

function eventKey(type, symbol, fromLevel, toLevel, threshold = "none") {
  return `notification:telegram:${type}:${symbol}:${tier(fromLevel)}:${tier(toLevel)}:${threshold}`;
}

function eventMessage(event, updatedAt) {
  const time = new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  return [event.title, "", ...event.lines, "", `檢查時間：${time}`].join("\n");
}

function buildEvents({ assets, ledger, alerts }) {
  const events = [];
  const states = alerts.__layerState || {};

  for (const asset of assets || []) {
    const symbol = String(asset?.symbol || "").trim();
    if (!symbol) continue;

    const previous = Number(states[symbol]?.currentLevel || 0);
    const current = getLevel(asset);
    const completed = doneLevel(ledger, symbol);
    const next = Math.min(MAX_LEVEL, completed + 1);
    const amount = num(asset?.amounts?.[next - 1]);
    const discount = `${num(asset?.discount).toFixed(1)}%`;
    const price = num(asset?.price);
    const high = highPrice(asset);

    if (price > 0 && high > 0 && price >= high) {
      events.push({
        type: "new_high",
        symbol,
        fromLevel: current,
        toLevel: current,
        threshold: "high",
        key: eventKey("new_high", symbol, current, current, high.toFixed(4)),
        title: "🟢 DCA 折價獵人 新高通知",
        lines: [`${symbol} 觸及或突破高點`, `現價：${price.toFixed(4)}`, `高點：${high.toFixed(4)}`, "請確認 52 週高點／上市高點基準是否需要更新。"],
      });
    }

    if (current < previous) {
      events.push({
        type: "retreat",
        symbol,
        fromLevel: previous,
        toLevel: current,
        threshold: null,
        key: eventKey("retreat", symbol, previous, current),
        title: "🔄 DCA 折價獵人 回退通知",
        lines: [`${symbol} 已由 ${tier(previous)} 回退到 ${tier(current)}`, current === 0 ? "目前已離開買點區。" : `目前位於 ${tier(current)}。`, `目前跌幅：${discount}`],
      });
    }

    if (current > completed && current >= next) {
      events.push({
        type: "trigger",
        symbol,
        fromLevel: completed,
        toLevel: next,
        threshold: 100,
        key: eventKey("trigger", symbol, completed, next, 100),
        title: "🚨 DCA 折價獵人 買點警報",
        lines: [`${symbol} 已觸發 ${tier(next)}`, `目前跌幅：${discount}`, `本層建議：${amount}U`, "請打開 App 檢查今日決策。"],
      });
    }

    if (next <= MAX_LEVEL && current < next) {
      const progress = progressTo(asset, next);
      const threshold = topThreshold(progress);
      if (threshold) {
        events.push({
          type: "near",
          symbol,
          fromLevel: completed,
          toLevel: next,
          threshold,
          key: eventKey("near", symbol, completed, next, threshold),
          title: "🟡 DCA 折價獵人 預警",
          lines: [`${symbol} 接近 ${tier(next)}`, `目前進度：${progress.toFixed(0)}%`, `預警門檻：${threshold}%`, `目前跌幅：${discount}`, `本層建議：${amount}U`],
        });
      }
    }
  }

  return events;
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const { readLedger, readAlerts, writeAlerts, canSendAlert } = await import("../../lib/v16-ledger.js");
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const [pricesRes, walletRes, ledger, alerts] = await Promise.all([
      fetch(`${protocol}://${host}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "telegram-alerts" }) }),
      readLedger(),
      readAlerts(),
    ]);

    const prices = await readJson(pricesRes);
    const wallet = await readJson(walletRes);

    if (!pricesRes.ok) {
      const sent = await sendTelegramMessage(`🔴 DCA 折價獵人 API異常\n\n行情資料讀取失敗。\n錯誤：${prices?.error || pricesRes.status}`, { cooldownKey: "telegram-alerts:prices-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, alertType: "api_error", telegram: sent });
    }

    if (!(walletRes.ok && wallet?.ok)) {
      const sent = await sendTelegramMessage(`⚠️ DCA 折價獵人 Wallet讀取異常\n\n本次不發買點清單。\n錯誤：${wallet?.error || walletRes.status}`, { cooldownKey: "telegram-alerts:wallet-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, walletOk: false, telegram: sent });
    }

    const allEvents = buildEvents({ assets: prices?.data || [], ledger, alerts });
    const now = new Date().toISOString();
    const sendableEvents = allEvents.filter((event) => canSendAlert(alerts, event.key, now, event.type === "near" ? 24 * 365 : event.type === "new_high" ? 24 : 12));

    const nextAlerts = { ...(alerts || {}), __layerState: { ...(alerts.__layerState || {}) } };
    for (const asset of prices?.data || []) {
      const symbol = String(asset?.symbol || "").trim();
      if (symbol) nextAlerts.__layerState[symbol] = { currentLevel: getLevel(asset), updatedAt: now };
    }

    const telegramResults = [];
    for (const event of sendableEvents) {
      const sent = await sendTelegramMessage(eventMessage(event, prices?.updatedAt), { cooldownKey: `telegram-alerts:v16-event:${event.key}`, cooldownHours: 0 });
      telegramResults.push({ key: event.key, ok: sent.ok, skipped: Boolean(sent.skipped) });
      if (!sent.ok) return res.status(500).json({ ok: false, failedEvent: event.key, telegram: sent });
      nextAlerts[event.key] = { lastAlert: now, type: event.type, symbol: event.symbol, fromLevel: event.fromLevel, toLevel: event.toLevel, threshold: event.threshold || null };
    }

    const storage = await writeAlerts(nextAlerts);
    const view = (event) => ({ type: event.type, symbol: event.symbol, fromLevel: tier(event.fromLevel), toLevel: tier(event.toLevel), threshold: event.threshold || null, key: event.key });

    return res.status(200).json({
      ok: true,
      version: "16.4-new-high-notifications",
      sent: sendableEvents.length > 0,
      deduped: !sendableEvents.length && allEvents.length > 0,
      walletOk: true,
      eventCount: allEvents.length,
      sendableCount: sendableEvents.length,
      storage: storage.store,
      telegramResults,
      events: allEvents.map(view),
      sentEvents: sendableEvents.map(view),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "telegram_alert_failed" });
  }
}

module.exports = handler;
