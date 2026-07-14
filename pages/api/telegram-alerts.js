const { sendTelegramMessage } = require("../../lib/telegram/notify");
const { isPricesHealthy, isWalletHealthy, healthSummary } = require("../../lib/v16-health");

const MAX_LEVEL = 4;
const STATE_VERSION = 3;
const QUANTITY_TOLERANCE = 0.000000000001;
const COST_TOLERANCE_USD = 0.05;

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

function ledgerKey(ledger, symbol) {
  const target = stripOn(symbol);
  return Object.keys(ledger || {}).find((key) => stripOn(key) === target) || symbol;
}

function hasLedgerTier(ledger, symbol, level) {
  if (level < 1) return false;
  const rows = ledger?.[ledgerKey(ledger, symbol)]?.[`D${level}`];
  return Array.isArray(rows) && rows.length > 0;
}

function ledgerDoneLevel(ledger, symbol) {
  for (let level = MAX_LEVEL; level >= 1; level -= 1) {
    if (hasLedgerTier(ledger, symbol, level)) return level;
  }
  return 0;
}

function normalizeHoldings(payload = {}) {
  const rows = payload?.totals?.holdings || payload?.summary?.holdings || payload?.holdings || [];
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [stripOn(row.symbol), row]));
}

function normalizeStates(alerts = {}) {
  const source = alerts.__layerState || {};
  const map = new Map();
  for (const [key, value] of Object.entries(source)) map.set(stripOn(key), value || {});
  return map;
}

function holdingSnapshot(holdings, symbol) {
  const holding = holdings.get(stripOn(symbol)) || {};
  return {
    quantity: num(holding.quantity),
    totalCost: num(holding.totalCost),
    currentValue: num(holding.currentValue || holding.marketValue || holding.positionValue),
    costReady: num(holding.totalCost) > 0 && !holding.costBasisMissing,
  };
}

function eventKey(type, symbol, fromLevel, toLevel) {
  return `notification:telegram:v3:${type}:${stripOn(symbol)}:${tier(fromLevel)}:${tier(toLevel)}`;
}

function holdingEventKey(symbol, quantity, totalCost) {
  return `notification:telegram:v3:holding_delta:${stripOn(symbol)}:${quantity.toFixed(12)}:${totalCost.toFixed(4)}`;
}

function eventMessage(event, updatedAt) {
  const time = new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  return [event.title, "", ...event.lines, "", `檢查時間：${time}`].join("\n");
}

function buildEvents({ assets, ledger, alerts, holdings }) {
  const events = [];
  const states = normalizeStates(alerts);
  let baselineCount = 0;

  for (const asset of assets || []) {
    const symbol = String(asset?.symbol || "").trim();
    if (!symbol) continue;

    const previousState = states.get(stripOn(symbol)) || null;
    const current = getLevel(asset);
    const previousLevel = Number(previousState?.currentLevel || 0);
    const completed = ledgerDoneLevel(ledger, symbol);
    const discount = `${num(asset?.discount).toFixed(1)}%`;
    const snapshot = holdingSnapshot(holdings, symbol);
    const validBaseline = Boolean(
      previousState &&
      Number(previousState.snapshotVersion) === STATE_VERSION &&
      Number.isFinite(Number(previousState.quantity)) &&
      Number.isFinite(Number(previousState.totalCost))
    );

    // 首次同步或版本升級只建立基準，不得把全部既有持倉誤報為新買入。
    if (!validBaseline) {
      baselineCount += 1;
      continue;
    }

    const previousQuantity = num(previousState.quantity);
    const previousTotalCost = num(previousState.totalCost);
    const quantityIncrease = snapshot.quantity - previousQuantity;
    const costIncrease = snapshot.totalCost - previousTotalCost;

    if (quantityIncrease > QUANTITY_TOLERANCE) {
      const costDeltaReady = snapshot.costReady && previousTotalCost > 0 && costIncrease > COST_TOLERANCE_USD;
      events.push({
        type: "holding_delta",
        symbol,
        fromLevel: previousLevel,
        toLevel: current,
        key: holdingEventKey(symbol, snapshot.quantity, snapshot.totalCost),
        title: "✅ DCA 折價獵人 持倉增加已偵測",
        lines: [
          `${symbol} 持倉數量已增加`,
          `新增數量：約 ${quantityIncrease.toFixed(stripOn(symbol) === "BTC" ? 8 : 6)}`,
          costDeltaReady ? `新增成本：約 ${costIncrease.toFixed(2)}U` : "新增成本：資料不足，未推算",
          `目前總數量：${snapshot.quantity.toFixed(stripOn(symbol) === "BTC" ? 8 : 6)}`,
          `目前總成本：${snapshot.costReady ? `${snapshot.totalCost.toFixed(2)}U` : "N/A"}`,
          `目前價格層級：${tier(current)}`,
          `逢低完成層級：${tier(completed)}`,
          "此通知只代表持倉差額；不會自動判定為定期定額或逢低買進。",
          "只有折價獵人交易紀錄才會影響 D 層完成度。"
        ]
      });
    }

    if (current === previousLevel) continue;

    if (current > previousLevel) {
      const amount = num(asset?.amounts?.[current - 1]);
      const needsBuy = current > completed;
      events.push({
        type: needsBuy ? "layer_down_buy" : "layer_down_recorded",
        symbol,
        fromLevel: previousLevel,
        toLevel: current,
        key: eventKey(needsBuy ? "layer_down_buy" : "layer_down_recorded", symbol, previousLevel, current),
        title: needsBuy ? "🚨 DCA 折價獵人 層級下移" : "🔽 DCA 折價獵人 層級下移",
        lines: needsBuy
          ? [
              `${symbol} 已由 ${tier(previousLevel)} 下移到 ${tier(current)}`,
              `目前跌幅：${discount}`,
              `本層建議：${amount}U`,
              `折價交易紀錄完成層級：${tier(completed)}`,
              "新層級尚未在折價交易紀錄中完成。"
            ]
          : [
              `${symbol} 已由 ${tier(previousLevel)} 下移到 ${tier(current)}`,
              `目前跌幅：${discount}`,
              `折價交易紀錄已完成到 ${tier(completed)}`,
              "不需要重複買入。"
            ]
      });
    } else {
      events.push({
        type: "layer_up",
        symbol,
        fromLevel: previousLevel,
        toLevel: current,
        key: eventKey("layer_up", symbol, previousLevel, current),
        title: "🔄 DCA 折價獵人 層級回升",
        lines: [
          `${symbol} 已由 ${tier(previousLevel)} 回升到 ${tier(current)}`,
          current === 0 ? "目前已離開買點區。" : `目前位於 ${tier(current)}。`,
          `目前跌幅：${discount}`,
          "層級已改變，因此通知一次。"
        ]
      });
    }
  }

  return { events, baselineCount };
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { readLedger, readAlerts, writeAlerts } = await import("../../lib/v16-ledger.js");
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;

    const [pricesRes, walletRes, truthRes, ledger, alerts] = await Promise.all([
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/sync-wallet?t=${Date.now()}`, {
        cache: "no-store",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "telegram-alerts-v3" })
      }),
      fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" }),
      readLedger(),
      readAlerts()
    ]);

    const prices = await readJson(pricesRes);
    const wallet = await readJson(walletRes);
    const portfolioTruth = truthRes.ok ? await readJson(truthRes) : {};
    const holdings = normalizeHoldings(portfolioTruth || {});
    const health = healthSummary({ prices, wallet });

    if (!pricesRes.ok || !isPricesHealthy(prices)) {
      const reason = prices?.error || prices?.message || `http_${pricesRes.status}_unhealthy_payload`;
      const sent = await sendTelegramMessage(`🔴 DCA 折價獵人 API異常\n\n行情資料讀取失敗。\n錯誤：${reason}`, { cooldownKey: "telegram-alerts:prices-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, pricesOk: false, health, telegram: sent });
    }

    if (!walletRes.ok || !isWalletHealthy(wallet)) {
      const reason = wallet?.error || wallet?.message || `http_${walletRes.status}_unhealthy_payload`;
      const sent = await sendTelegramMessage(`⚠️ DCA 折價獵人 Wallet讀取異常\n\n本次不發買點清單。\n錯誤：${reason}`, { cooldownKey: "telegram-alerts:wallet-error", cooldownHours: 12 });
      return res.status(500).json({ ok: false, walletOk: false, health, walletStatus: walletRes.status, telegram: sent });
    }

    const assets = prices?.data || [];
    const built = buildEvents({ assets, ledger, alerts, holdings });
    const now = new Date().toISOString();
    const sendableEvents = built.events.filter((event) => !alerts?.[event.key]);

    const nextAlerts = {
      ...(alerts || {}),
      __telegramStateVersion: STATE_VERSION,
      __layerState: { ...(alerts.__layerState || {}) }
    };

    for (const asset of assets) {
      const symbol = String(asset?.symbol || "").trim();
      if (!symbol) continue;
      const snapshot = holdingSnapshot(holdings, symbol);
      nextAlerts.__layerState[symbol] = {
        snapshotVersion: STATE_VERSION,
        currentLevel: getLevel(asset),
        completedLevel: ledgerDoneLevel(ledger, symbol),
        quantity: snapshot.quantity,
        totalCost: snapshot.totalCost,
        currentValue: snapshot.currentValue,
        updatedAt: now
      };
    }

    // 先保存新基準，避免版本升級或舊狀態造成整批既有持倉誤報。
    await writeAlerts(nextAlerts);

    const telegramResults = [];
    for (const event of sendableEvents) {
      const sent = await sendTelegramMessage(eventMessage(event, prices?.updatedAt), { cooldownKey: event.key, cooldownHours: 24 * 365 });
      telegramResults.push({ key: event.key, ok: sent.ok, skipped: Boolean(sent.skipped) });
      if (!sent.ok) return res.status(500).json({ ok: false, failedEvent: event.key, telegram: sent });
      nextAlerts[event.key] = {
        lastAlert: now,
        type: event.type,
        symbol: event.symbol,
        fromLevel: event.fromLevel,
        toLevel: event.toLevel,
        repeatMode: event.type === "holding_delta" ? "true_delta_once" : "layer_change_only"
      };
    }

    const storage = await writeAlerts(nextAlerts);
    const view = (event) => ({ type: event.type, symbol: event.symbol, fromLevel: tier(event.fromLevel), toLevel: tier(event.toLevel), key: event.key });

    return res.status(200).json({
      ok: true,
      version: "17.1-snapshot-delta-strategy-separated",
      sent: sendableEvents.length > 0,
      baselineInitializedCount: built.baselineCount,
      repeatMode: "true_holding_delta_or_layer_change_once",
      purchaseDetection: "snapshot_difference_only",
      dLayerAccounting: "ledger_only",
      firstSyncPolicy: "baseline_only_no_purchase_notification",
      pricesOk: true,
      walletOk: true,
      portfolioTruthOk: Boolean(truthRes.ok),
      holdingCount: holdings.size,
      health,
      eventCount: built.events.length,
      sendableCount: sendableEvents.length,
      suppressedDuplicateCount: built.events.length - sendableEvents.length,
      storage: storage.store,
      telegramResults,
      events: built.events.map(view),
      sentEvents: sendableEvents.map(view)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "telegram_alert_failed" });
  }
}

module.exports = handler;
