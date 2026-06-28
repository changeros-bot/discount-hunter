const { sendTelegramMessage } = require("../../lib/telegram/notify");

const NEAR_THRESHOLDS = [92, 94, 96, 98];
const MAX_LEVEL = 4;

function safeNumber(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim();
}

function stripOn(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function levelLabel(level) {
  return level > 0 ? `D${level}` : "D0";
}

function getCurrentLevel(asset) {
  const fromSignal = Number(asset?.signal?.level || 0);
  if (Number.isFinite(fromSignal) && fromSignal > 0) return Math.min(MAX_LEVEL, Math.max(0, fromSignal));

  const depth = Math.abs(safeNumber(asset?.discount));
  const rules = (asset?.rules || []).map((rule) => Math.abs(safeNumber(rule)));
  let level = 0;
  for (let i = 0; i < rules.length; i += 1) {
    if (depth >= rules[i]) level = i + 1;
  }
  return Math.min(MAX_LEVEL, Math.max(0, level));
}

function getProgressToLevel(asset, targetLevel) {
  if (!targetLevel || targetLevel < 1 || targetLevel > MAX_LEVEL) return 0;
  const depth = Math.abs(safeNumber(asset?.discount));
  const rules = (asset?.rules || []).map((rule) => Math.abs(safeNumber(rule)));
  const targetDepth = rules[targetLevel - 1];
  if (!targetDepth) return 0;
  return Math.max(0, Math.min(100, (depth / targetDepth) * 100));
}

function getTargetAmount(asset, level) {
  return safeNumber(asset?.amounts?.[level - 1]);
}

function formatPct(value) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function eventKey(channel, type, symbol, fromLevel, toLevel, threshold = "none") {
  return `notification:${channel}:${type}:${symbol}:${levelLabel(fromLevel)}:${levelLabel(toLevel)}:${threshold}`;
}

function findLedgerSymbol(ledger, symbol) {
  const target = stripOn(symbol);
  return Object.keys(ledger || {}).find((key) => stripOn(key) === target) || symbol;
}

function hasLedgerTier(ledger, symbol, level) {
  if (!level || level < 1) return false;
  const key = findLedgerSymbol(ledger, symbol);
  const rows = ledger?.[key]?.[`D${level}`];
  return Array.isArray(rows) && rows.length > 0;
}

function completedLedgerLevel(ledger, symbol) {
  for (let level = MAX_LEVEL; level >= 1; level -= 1) {
    if (hasLedgerTier(ledger, symbol, level)) return level;
  }
  return 0;
}

function buildEvents({ assets, ledger, alerts }) {
  const events = [];
  const state = alerts.__layerState || {};

  for (const asset of assets || []) {
    const symbol = normalizeSymbol(asset.symbol);
    if (!symbol) continue;

    const previousLevel = Number(state[symbol]?.currentLevel || 0);
    const currentLevel = getCurrentLevel(asset);
    const completedLevel = completedLedgerLevel(ledger, symbol);
    const nextLevel = Math.min(MAX_LEVEL, completedLevel + 1);

    if (currentLevel < previousLevel) {
      events.push({
        type: "retreat",
        symbol,
        fromLevel: previousLevel,
        toLevel: currentLevel,
        key: eventKey("telegram", "retreat", symbol, previousLevel, currentLevel),
        title: "🔄 DCA 折價獵人 回退通知",
        lines: [
          `${symbol} 已由 ${levelLabel(previousLevel)} 回退到 ${levelLabel(currentLevel)}`,
          currentLevel === 0 ? "目前已離開所有買點區。" : `目前位於 ${levelLabel(currentLevel)}。`,
          `目前跌幅：${formatPct(asset.discount)}`,
        ],
      });
    }

    if (currentLevel > completedLevel && currentLevel >= nextLevel) {
      const toLevel = nextLevel;
      events.push({
        type: "trigger",
        symbol,
        fromLevel: completedLevel,
        toLevel,
        key: eventKey("telegram", "trigger", symbol, completedLevel, toLevel, 100),
        title: "🚨 DCA 折價獵人 買點警報",
        lines: [
          `${symbol} 已觸發 ${levelLabel(toLevel)}`,
          `目前跌幅：${formatPct(asset.discount)}`,
          `本層建議：${getTargetAmount(asset, toLevel)}U`,
          "請打開 App 檢查今日決策。",
        ],
      });
    }

    if (nextLevel <= MAX_LEVEL && currentLevel < nextLevel) {
      const progress = getProgressToLevel(asset, nextLevel);
      for (const threshold of NEAR_THRESHOLDS) {
        const crossed = progress >= threshold;
        const alreadyTriggered = currentLevel >= nextLevel;
        if (!crossed || alreadyTriggered) continue;
        events.push({
          type: "near",
          symbol,
          fromLevel: completedLevel,
          toLevel: nextLevel,
          threshold,
          key: eventKey("telegram", "near", symbol, completedLevel, nextLevel, threshold),
          title: "🟡 DCA 折價獵人 預警",
          lines: [
            `${symbol} 接近 ${levelLabel(nextLevel)}`,
            `目前進度：${progress.toFixed(0)}%`,
            `預警門檻：${threshold}%`,
            `目前跌幅：${formatPct(asset.discount)}`,
            `本層建議：${getTargetAmount(asset, nextLevel)}U`,
          ],
        });
      }
    }
  }

  return events;
}

function formatMessage(events, updatedAt) {
  const lines = [
    "🔔 DCA 折價獵人 通知",
    "",
    `事件數量：${events.length}`,
    `檢查時間：${new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    "",
  ];

  events.forEach((event, index) => {
    lines.push(`${index + 1}. ${event.title}`);
    for (const line of event.lines || []) lines.push(line);
    lines.push("");
  });

  return lines.join("\n");
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const [{ readLedger, readAlerts, writeAlerts, canSendAlert }, { default: fetchPolyfill }] = await Promise.all([
      import("../../lib/v16-ledger.js"),
      Promise.resolve({ default: fetch }),
    ]);

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const [pricesRes, walletRes, ledger, alerts] = await Promise.all([
      fetchPolyfill(`${protocol}://${host}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetchPolyfill(`${protocol}://${host}/api/sync-wallet?t=${Date.now()}`, { cache: "no-store", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "telegram-alerts" }) }),
      readLedger(),
      readAlerts(),
    ]);

    const prices = await readJson(pricesRes);
    const wallet = await readJson(walletRes);

    if (!pricesRes.ok) {
      const message = [
        "🔴 DCA 折價獵人 API異常",
        "",
        "行情資料讀取失敗。",
        `錯誤：${prices?.message || prices?.error || pricesRes.status}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message, { cooldownKey: "telegram-alerts:prices-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, alertType: "api_error", telegram: sent });
    }

    const walletOk = walletRes.ok && wallet?.ok;
    if (!walletOk) {
      const message = [
        "⚠️ DCA 折價獵人 Wallet讀取異常",
        "",
        "本次無法確認 Wallet 狀態，為避免錯誤提醒，本次不發買點清單。",
        `錯誤：${wallet?.error || walletRes.status}`,
        `檢查時間：${new Date(prices?.updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
      ].join("\n");
      const sent = await sendTelegramMessage(message, { cooldownKey: "telegram-alerts:wallet-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, walletOk: false, telegram: sent });
    }

    const allEvents = buildEvents({ assets: prices?.data || [], ledger, alerts });
    const sendableEvents = allEvents.filter((event) => canSendAlert(alerts, event.key, new Date().toISOString(), event.type === "near" ? 24 * 365 : 12));

    const nextAlerts = { ...(alerts || {}), __layerState: { ...(alerts.__layerState || {}) } };
    for (const asset of prices?.data || []) {
      const symbol = normalizeSymbol(asset.symbol);
      if (!symbol) continue;
      nextAlerts.__layerState[symbol] = {
        currentLevel: getCurrentLevel(asset),
        updatedAt: new Date().toISOString(),
      };
    }

    let sent = { ok: true, skipped: true, deduped: true };
    if (sendableEvents.length) {
      const message = formatMessage(sendableEvents, prices?.updatedAt);
      sent = await sendTelegramMessage(message, { cooldownKey: `telegram-alerts:v16-events:${sendableEvents.map((event) => event.key).join("|")}`, cooldownHours: 0 });
      if (!sent.ok) return res.status(500).json({ ok: false, eventCount: allEvents.length, sendableCount: sendableEvents.length, telegram: sent });
      const now = new Date().toISOString();
      for (const event of sendableEvents) nextAlerts[event.key] = { lastAlert: now, type: event.type, symbol: event.symbol, fromLevel: event.fromLevel, toLevel: event.toLevel, threshold: event.threshold || null };
    }

    const storage = await writeAlerts(nextAlerts);

    return res.status(200).json({
      ok: true,
      version: "16.2-notification-sop-events",
      sent: Boolean(sendableEvents.length && !sent.skipped),
      deduped: !sendableEvents.length && allEvents.length > 0,
      walletOk: true,
      eventCount: allEvents.length,
      sendableCount: sendableEvents.length,
      storage: storage.store,
      events: allEvents.map((event) => ({ type: event.type, symbol: event.symbol, fromLevel: levelLabel(event.fromLevel), toLevel: levelLabel(event.toLevel), threshold: event.threshold || null, key: event.key })),
      sentEvents: sendableEvents.map((event) => ({ type: event.type, symbol: event.symbol, fromLevel: levelLabel(event.fromLevel), toLevel: levelLabel(event.toLevel), threshold: event.threshold || null, key: event.key })),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Telegram alert failed" });
  }
}

module.exports = handler;
