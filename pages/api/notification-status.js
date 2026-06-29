const { isPricesHealthy, isWalletHealthy, healthSummary } = require("../../lib/v16-health");
const { hasKvConfig, requiresDurableKv } = require("../../lib/state/kv");

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
      events.push({ type: "new_high", symbol, fromLevel: current, toLevel: current, threshold: "high", key: eventKey("new_high", symbol, current, current, high.toFixed(4)), amount, discount });
    }

    if (current < previous) {
      events.push({ type: "retreat", symbol, fromLevel: previous, toLevel: current, threshold: null, key: eventKey("retreat", symbol, previous, current), amount, discount });
    }

    if (current > completed && current >= next) {
      events.push({ type: "trigger", symbol, fromLevel: completed, toLevel: next, threshold: 100, key: eventKey("trigger", symbol, completed, next, 100), amount, discount });
    }

    if (next <= MAX_LEVEL && current < next) {
      const progress = progressTo(asset, next);
      const threshold = topThreshold(progress);
      if (threshold) {
        events.push({ type: "near", symbol, fromLevel: completed, toLevel: next, threshold, key: eventKey("near", symbol, completed, next, threshold), amount, discount, progress: Number(progress.toFixed(0)) });
      }
    }
  }

  return events;
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const { readLedger, readAlerts, canSendAlert } = await import("../../lib/v16-ledger.js");
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const [pricesRes, walletRes, ledger, alerts] = await Promise.all([
      fetch(`${protocol}://${host}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "notification-status" }) }),
      readLedger(),
      readAlerts(),
    ]);

    const prices = await readJson(pricesRes);
    const wallet = await readJson(walletRes);
    const health = healthSummary({ prices, wallet });
    const pricesOk = pricesRes.ok && isPricesHealthy(prices);
    const walletOk = walletRes.ok && isWalletHealthy(wallet);
    const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    const cooldownDurableOk = !(requiresDurableKv() && !hasKvConfig());
    const allEvents = pricesOk ? buildEvents({ assets: prices?.data || [], ledger, alerts }) : [];
    const now = new Date().toISOString();
    const sendableEvents = allEvents.filter((event) => canSendAlert(alerts, event.key, now, event.type === "near" ? 24 * 365 : event.type === "new_high" ? 24 : 12));

    const currentBuySignals = (prices?.data || [])
      .filter((asset) => Number(asset?.signal?.level || 0) > 0)
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        tier: `D${Number(asset.signal.level)}`,
        amount: asset.signal.amount,
        price: asset.price,
        high: asset.high,
        discount: asset.discount,
        signalText: asset.signal.text,
        ledgerDone: hasLedgerTier(ledger, asset.symbol, Number(asset.signal.level)),
      }));

    const pipeline = {
      decision: currentBuySignals.length > 0 ? "PASS" : "NO_SIGNAL",
      prices: pricesOk ? "PASS" : `FAIL_${pricesRes.status}`,
      wallet: walletOk ? "PASS" : `FAIL_${walletRes.status}`,
      config: telegramConfigured ? "PASS" : "FAIL_TELEGRAM_ENV_MISSING",
      cooldownStore: cooldownDurableOk ? "PASS" : "FAIL_MISSING_KV_FOR_COOLDOWN",
      eventBuilder: allEvents.length > 0 ? "PASS" : "NO_EVENT_BUILT",
      sendable: sendableEvents.length > 0 ? "PASS" : allEvents.length > 0 ? "DEDUPED_OR_COOLDOWN" : "NO_SENDABLE_EVENT",
      telegramSend: "NOT_SENT_BY_STATUS_ENDPOINT",
    };

    return res.status(200).json({
      ok: pricesOk && walletOk && telegramConfigured && cooldownDurableOk,
      version: "notification-status-v1",
      checkedAt: now,
      pipeline,
      config: {
        telegramConfigured,
        hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
        hasKvConfig: hasKvConfig(),
        requiresDurableKv: requiresDurableKv(),
      },
      health,
      counts: {
        currentBuySignals: currentBuySignals.length,
        events: allEvents.length,
        sendableEvents: sendableEvents.length,
      },
      currentBuySignals,
      events: allEvents,
      sendableEvents,
      diagnosis: sendableEvents.length
        ? "Notification event exists and is sendable. If Telegram did not arrive, call /api/telegram-alerts and inspect telegramResults."
        : allEvents.length
          ? "Events exist but are deduped or under cooldown."
          : currentBuySignals.length
            ? "Buy signal exists but notification event builder did not create a sendable event. Check ledger completed level and alert state."
            : "No active buy signal from /api/prices."
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "notification_status_failed" });
  }
}

module.exports = handler;
