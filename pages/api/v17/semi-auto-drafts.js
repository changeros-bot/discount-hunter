import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { adaptActionToCard } from "../../../lib/v17-ui-adapter";
import { V17_STORAGE_KEYS, readV17State } from "../../../lib/v17-storage";

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function buildDraft(card) {
  const amount = toNumber(card.amount, 0);
  const price = toNumber(card.price, 0);
  const estimatedQty = price > 0 ? amount / price : 0;
  const copyText = [
    "【DCA 折價獵人｜半自動下單草稿】",
    `標的：${card.symbol}`,
    `買點：${card.tier}`,
    `參考價格：${price ? `$${price.toFixed(4)}` : "N/A"}`,
    `模擬/建議金額：${amount.toFixed(2)} USDT`,
    `估算數量：約 ${estimatedQty ? estimatedQty.toFixed(8) : "N/A"}`,
    "動作：手動到 Binance 確認後才下單",
    "注意：這不是自動交易，也不是強制買入。"
  ].join("\n");

  return {
    symbol: card.symbol,
    name: card.name,
    tier: card.tier,
    level: card.level,
    status: card.status,
    statusLabel: card.statusLabel,
    price,
    discount: card.discount,
    discountText: card.discountText,
    ruleText: card.ruleText,
    amountUsd: amount,
    estimatedQty,
    executionMode: "MANUAL_CONFIRM_ONLY",
    orderType: "manual_market_or_limit_decision",
    allowedAction: amount > 0 && price > 0 ? "CREATE_MANUAL_DRAFT" : "DATA_NOT_READY",
    checklist: [
      "確認 App 顯示為待買入 / 半自動草稿",
      "確認標的是本人要買的代幣化股票或 BTC",
      "確認金額沒有超過本層預算",
      "到 Binance 手動輸入，不由 App 自動送單",
      "完成後回 App 按已完成；不買則按略過本層"
    ],
    copyText
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const now = new Date().toISOString();
    const body = req.method === "POST" ? (req.body || {}) : {};
    const markets = body.markets || body.marketData || {};
    const assets = getAssetRegistry();
    const storedAction = await readV17State(V17_STORAGE_KEYS.ACTION_STATE, { states: {} });
    const storedEvents = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const events = Array.isArray(body.events) ? body.events : (storedEvents.events || []);
    const previousStates = body.previousStates || storedAction.states || {};
    const result = buildV17Decisions({ assets, markets, events, previousStates, now });
    const cards = (result.actionQueue || []).map(adaptActionToCard);
    const drafts = cards.map(buildDraft);

    return res.status(200).json({
      ok: true,
      version: "v17-semi-auto-drafts-v1",
      updatedAt: now,
      mode: "半自動：只產生下單草稿，不連券商、不自動送單",
      draftCount: drafts.length,
      totalDraftAmountUsd: drafts.reduce((sum, draft) => sum + Number(draft.amountUsd || 0), 0),
      safety: {
        autoTrade: false,
        requiresManualBinanceConfirmation: true,
        killSwitchDefault: true,
        note: "App 只產生可複製的手動下單草稿；實際交易必須由使用者在 Binance 手動確認。"
      },
      drafts
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "semi_auto_drafts_failed" });
  }
}
