const { sendTelegramMessage } = require("../../lib/telegram/notify");
const { isPricesHealthy, isWalletHealthy, healthSummary } = require("../../lib/v16-health");

const MAX_LEVEL = 4;
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
  for (let i = 0; i < rules.length; i += 1) {
    if (depth >= rules[i]) level = i + 1;
  }
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

function holdingSnapshot(holdings, symbol) {
  const holding = holdings.get(stripOn(symbol)) || {};
  return {
    quantity: num(holding.quantity),
    totalCost: num(holding.totalCost),
    currentValue: num(holding.currentValue || holding.marketValue || holding.positionValue),
  };
}

function costDoneLevel(asset, holdings) {
  const holding = holdings.get(stripOn(asset?.symbol));
  const totalCost = num(holding?.totalCost);
  const amounts = Array.isArray(asset?.amounts) ? asset.amounts.map(num) : [];
  if (!(totalCost > 0) || amounts.length === 0) return 0;

  let cumulative = 0;
  let completed = 0;
  for (let i = 0; i < Math.min(MAX_LEVEL, amounts.length); i += 1) {
    cumulative += amounts[i];
    if (totalCost + 0.25 >= cumulative) completed = i + 1;
    else break;
  }
  return completed;
}

function detectedDoneLevel(asset, ledger, holdings) {
  return Math.max(
    ledgerDoneLevel(ledger, asset?.symbol),
    costDoneLevel(asset, holdings)
  );
}

function eventKey(type, symbol, fromLevel, toLevel) {
  return `notification:telegram:${type}:${symbol}:${tier(fromLevel)}:${tier(toLevel)}`;
}

function purchaseEventKey(symbol, quantity, totalCost) {
  return `notification:telegram:purchase_detected:${stripOn(symbol)}:${quantity.toFixed(12)}:${totalCost.toFixed(4)}`;
}

function eventMessage(event, updatedAt) {
  const time = new Date(updatedAt || Date.now()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  return [event.title, "", ...event.lines, "", `檢查時間：${time}`].join("\n");
}

function buildEvents({ assets, ledger, alerts, holdings }) {
  const events = [];
  const states = alerts.__layerState || {};

  for (const asset of assets || []) {
    const symbol = String(asset?.symbol || "").trim();
    if (!symbol) continue;

    const stateExists = Object.prototype.hasOwnProperty.call(states, symbol);
    const previousState = states[symbol] || {};
    const previous = Number(previousState.currentLevel || 0);
    const current = getLevel(asset);
    const completed = detectedDoneLevel(asset, ledger, holdings);
    const discount = `${num(asset?.discount).toFixed(1)}%`;
    const snapshot = holdingSnapshot(holdings, symbol);
    const previousQuantity = num(previousState.quantity);
    const previousTotalCost = num(previousState.totalCost);
    const quantityIncrease = snapshot.quantity - previousQuantity;
    const costIncrease = snapshot.totalCost - previousTotalCost;

    if (stateExists && quantityIncrease > QUANTITY_TOLERANCE) {
      const estimatedAmount = costIncrease > COST_TOLERANCE_USD ? costIncrease : 0;
      events.push({
        type: "purchase_detected",
        symbol,
        fromLevel: previous,
        toLevel: current,
        key: purchaseEventKey(symbol, snapshot.quantity, snapshot.totalCost),
        title: "✅ DCA 折價獵人 已偵測買入",
        lines: [
          `${symbol} 交易所持倉數量已增加`,
          `新增數量：約 ${quantityIncrease.toFixed(stripOn(symbol) === "BTC" ? 8 : 6)}`,
          estimatedAmount > 0 ? `新增投入：約 ${estimatedAmount.toFixed(2)}U` : "新增投入：成本資料尚未完整更新",
          `目前總數量：${snapshot.quantity.toFixed(stripOn(symbol) === "BTC" ? 8 : 6)}`,
          `目前層級：${tier(current)}`,
          `已偵測完成層級：${tier(completed)}`,
          completed >= current && current > 0 ? "本層已完成，不再重複提醒買入。" : "持倉已更新；同一筆交易只通知一次。"
        ]
      });
    }

    // 第一次建立狀態時，只在「尚未買到目前層」才通知一次。
    if (!stateExists) {
      if (current > completed && current > 0) {
        const amount = num(asset?.amounts?.[current - 1]);
        events.push({
          type: "trigger",
          symbol,
          fromLevel: completed,
          toLevel: current,
          key: eventKey("trigger", symbol, completed, current),
          title: "🚨 DCA 折價獵人 買點警報",
          lines: [
            `${symbol} 已觸發 ${tier(current)}`,
            `目前跌幅：${discount}`,
            `本層建議：${amount}U`,
            `已偵測完成層級：${tier(completed)}`,
            "請打開 App 檢查今日決策。"
          ]
        });
      }
      continue;
    }

    // 同一層內價格波動不推播；但上方已獨立檢查交易所買入。
    if (current === previous) continue;

    if (current > previous) {
      const amount = num(asset?.amounts?.[current - 1]);
      const needsBuy = current > completed;
      events.push({
        type: needsBuy ? "layer_down_buy" : "layer_down_completed",
        symbol,
        fromLevel: previous,
        toLevel: current,
        key: eventKey(needsBuy ? "layer_down_buy" : "layer_down_completed", symbol, previous, current),
        title: needsBuy ? "🚨 DCA 折價獵人 層級下移" : "🔽 DCA 折價獵人 層級下移",
        lines: needsBuy
          ? [
              `${symbol} 已由 ${tier(previous)} 下移到 ${tier(current)}`,
              `目前跌幅：${discount}`,
              `本層建議：${amount}U`,
              `已偵測完成層級：${tier(completed)}`,
              "新層級尚未完成，請打開 App 檢查。"
            ]
          : [
              `${symbol} 已由 ${tier(previous)} 下移到 ${tier(current)}`,
              `目前跌幅：${discount}`,
              "此層已從持倉成本／買入紀錄偵測完成。",
              "不需要重複買入。"
            ]
      });
    } else {
      events.push({
        type: "layer_up",
        symbol,
        fromLevel: previous,
        toLevel: current,
        key: eventKey("layer_up", symbol, previous, current),
        title: "🔄 DCA 折價獵人 層級回升",
        lines: [
          `${symbol} 已由 ${tier(previous)} 回升到 ${tier(current)}`,
          current === 0 ? "目前已離開買點區。" : `目前位於 ${tier(current)}。`,
          `目前跌幅：${discount}`,
          "層級已改變，因此通知一次。"
        ]
      });
    }
  }

  return events;
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
        body: JSON.stringify({ source: "telegram-alerts" })
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
      const sent = await sendTelegramMessage(
        `🔴 DCA 折價獵人 API異常\n\n行情資料讀取失敗。\n錯誤：${reason}`,
        { cooldownKey: "telegram-alerts:prices-error", cooldownHours: 12 }
      );
      return res.status(500).json({ ok: false, pricesOk: false, health, telegram: sent });
    }

    if (!walletRes.ok || !isWalletHealthy(wallet)) {
      const reason = wallet?.error || wallet?.message || `http_${walletRes.status}_unhealthy_payload`;
      const sent = await sendTelegramMessage(
        `⚠️ DCA 折價獵人 Wallet讀取異常\n\n本次不發買點清單。\n錯誤：${reason}`,
        { cooldownKey: "telegram-alerts:wallet-error", cooldownHours: 12 }
      );
      return res.status(500).json({ ok: false, walletOk: false, health, walletStatus: walletRes.status, telegram: sent });
    }

    const assets = prices?.data || [];
    const allEvents = buildEvents({ assets, ledger, alerts, holdings });
    const now = new Date().toISOString();
    const sendableEvents = allEvents.filter((event) => !alerts?.[event.key]);

    const nextAlerts = {
      ...(alerts || {}),
      __layerState: { ...(alerts.__layerState || {}) }
    };

    for (const asset of assets) {
      const symbol = String(asset?.symbol || "").trim();
      if (!symbol) continue;
      const snapshot = holdingSnapshot(holdings, symbol);
      nextAlerts.__layerState[symbol] = {
        currentLevel: getLevel(asset),
        completedLevel: detectedDoneLevel(asset, ledger, holdings),
        quantity: snapshot.quantity,
        totalCost: snapshot.totalCost,
        currentValue: snapshot.currentValue,
        updatedAt: now
      };
    }

    const telegramResults = [];
    for (const event of sendableEvents) {
      const sent = await sendTelegramMessage(
        eventMessage(event, prices?.updatedAt),
        { cooldownKey: event.key, cooldownHours: 24 * 365 }
      );
      telegramResults.push({ key: event.key, ok: sent.ok, skipped: Boolean(sent.skipped) });
      if (!sent.ok) return res.status(500).json({ ok: false, failedEvent: event.key, telegram: sent });
      nextAlerts[event.key] = {
        lastAlert: now,
        type: event.type,
        symbol: event.symbol,
        fromLevel: event.fromLevel,
        toLevel: event.toLevel,
        repeatMode: event.type === "purchase_detected" ? "holding_change_once" : "layer_change_only"
      };
    }

    const storage = await writeAlerts(nextAlerts);
    const view = (event) => ({
      type: event.type,
      symbol: event.symbol,
      fromLevel: tier(event.fromLevel),
      toLevel: tier(event.toLevel),
      key: event.key
    });

    return res.status(200).json({
      ok: true,
      version: "17.0-layer-and-purchase-change-notifications",
      sent: sendableEvents.length > 0,
      repeatMode: "layer_change_or_purchase_change_once",
      purchaseDetection: "live_quantity_increase_with_cost_delta_when_available",
      pricesOk: true,
      walletOk: true,
      portfolioTruthOk: Boolean(truthRes.ok),
      holdingCount: holdings.size,
      health,
      eventCount: allEvents.length,
      sendableCount: sendableEvents.length,
      suppressedDuplicateCount: allEvents.length - sendableEvents.length,
      storage: storage.store,
      telegramResults,
      events: allEvents.map(view),
      sentEvents: sendableEvents.map(view)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "telegram_alert_failed" });
  }
}

module.exports = handler;
