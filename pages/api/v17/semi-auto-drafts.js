import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { adaptActionToCard } from "../../../lib/v17-ui-adapter";
import { V17_STORAGE_KEYS, readV17State } from "../../../lib/v17-storage";

const QUALITY_GATE = {
  BTC: { quality: "PASSED", label: "通過", role: "Cycle Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "週期核心資產；仍需人工確認，Draft 尚未 Source Verified。" },
  QQQON: { quality: "PASSED", label: "通過", role: "ETF Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "ETF 核心；Draft 尚未 Source Verified。" },
  NVDAON: { quality: "PASSED", label: "通過", role: "Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "核心 AI 標的；Draft 尚未 Source Verified。" },
  TSMON: { quality: "PASSED", label: "通過", role: "Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "核心半導體標的；Draft 尚未 Source Verified。" },
  AVGOON: { quality: "PASSED", label: "通過", role: "Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "核心 AI 基礎建設標的；Draft 尚未 Source Verified。" },
  GOOGLON: { quality: "PASSED", label: "通過", role: "Core", pipeline: "Draft", permission: "可草稿", allowDraft: true, whitelistCandidate: true, reason: "核心平台型標的；Draft 尚未 Source Verified。" },
  AMDON: { quality: "PASSED", label: "通過", role: "Satellite", pipeline: "Draft", permission: "可草稿但低於核心", allowDraft: true, whitelistCandidate: false, reason: "Quality 可通過，但 Portfolio Role 仍是衛星；資金不足時低於核心。" },
  MRVLON: { quality: "PASSED", label: "通過", role: "Satellite", pipeline: "Draft", permission: "可草稿但低於核心", allowDraft: true, whitelistCandidate: false, reason: "Quality 可通過，但 Portfolio Role 仍是衛星；資金不足時低於核心。" },
  RKLBON: { quality: "WATCH", label: "觀察", role: "Spec Watch", pipeline: "Draft", permission: "只深跌人工確認", allowDraft: true, whitelistCandidate: false, reason: "RKLBon 不做固定 DCA；只有 -50/-65/-80 深折扣才允許低優先人工草稿。" },
  SPCXON: { quality: "PENDING", label: "未檢查", role: "Data Pending", pipeline: "Draft", permission: "人工確認", allowDraft: false, whitelistCandidate: false, reason: "SPCXon 新上市 / 交易歷史不足；逢低必須人工確認資料源與上市以來高點，不自動產生草稿。" },
};

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function keyOf(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function qualityGateFor(card) {
  const key = keyOf(card.symbol);
  const q = QUALITY_GATE[key] || { quality: "PENDING", label: "未檢查", role: "Unknown", pipeline: "Draft", permission: "禁止", allowDraft: false, whitelistCandidate: false, reason: "Quality Gate 未建檔，不產生草稿。" };
  const pipelineApproved = q.pipeline === "Approved";
  const draftMode = q.allowDraft ? (pipelineApproved ? "CREATE_MANUAL_DRAFT" : "CREATE_MANUAL_REVIEW_DRAFT") : "QUALITY_GATE_BLOCKED";
  return {
    ...q,
    symbol: card.symbol,
    approvedForAutoWhitelist: Boolean(q.whitelistCandidate && pipelineApproved),
    requiresManualQualityConfirmation: !pipelineApproved || q.quality !== "PASSED" || q.role === "Satellite" || q.role === "Spec Watch",
    allowedAction: draftMode,
    note: pipelineApproved ? q.reason : `${q.reason}｜目前仍是 Draft / Pending Verification，不可作為自動交易白名單。`,
  };
}

function buildDraft(card, gate) {
  const amount = toNumber(card.amount, 0);
  const price = toNumber(card.price, 0);
  const estimatedQty = price > 0 ? amount / price : 0;
  const allowedAction = gate.allowedAction;
  const copyText = [
    "【DCA 折價獵人｜半自動下單草稿】",
    `標的：${card.symbol}`,
    `買點：${card.tier}`,
    `Quality：${gate.label}｜${gate.permission}`,
    `Pipeline：${gate.pipeline}｜${gate.role}`,
    `Quality Note：${gate.note}`,
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
    allowedAction: amount > 0 && price > 0 ? allowedAction : "DATA_NOT_READY",
    qualityGate: gate,
    checklist: [
      "確認 App 顯示為待買入 / 半自動草稿",
      `確認 Quality Gate：${gate.label} / ${gate.permission}`,
      "確認標的是本人要買的代幣化股票或 BTC",
      "確認金額沒有超過本層預算",
      "到 Binance 手動輸入，不由 App 自動送單",
      "完成後回 App 按已完成；不買則按略過本層"
    ],
    copyText
  };
}
function buildBlocked(card, gate) {
  return {
    symbol: card.symbol,
    tier: card.tier,
    discountText: card.discountText,
    amountUsd: toNumber(card.amount, 0),
    qualityGate: gate,
    reason: gate.note,
    blockedBy: "QUALITY_GATE",
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
    const routed = cards.map((card) => ({ card, gate: qualityGateFor(card) }));
    const drafts = routed.filter(({ gate }) => gate.allowDraft).map(({ card, gate }) => buildDraft(card, gate));
    const blocked = routed.filter(({ gate }) => !gate.allowDraft).map(({ card, gate }) => buildBlocked(card, gate));

    return res.status(200).json({
      ok: true,
      version: "v17-semi-auto-drafts-quality-gate-v2",
      updatedAt: now,
      mode: "半自動：Quality Gate 先擋，通過後只產生下單草稿，不連券商、不自動送單",
      qualityGatePolicy: "PASSED 可草稿；WATCH 低優先人工確認；PENDING/FAILED 不自動產生草稿。Draft/Pending Verification 不可進自動交易白名單。",
      draftCount: drafts.length,
      blockedCount: blocked.length,
      totalDraftAmountUsd: drafts.reduce((sum, draft) => sum + Number(draft.amountUsd || 0), 0),
      safety: {
        autoTrade: false,
        requiresManualBinanceConfirmation: true,
        killSwitchDefault: true,
        qualityGateEnabled: true,
        note: "App 只產生可複製的手動下單草稿；實際交易必須由使用者在 Binance 手動確認。"
      },
      drafts,
      blocked,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "semi_auto_drafts_failed" });
  }
}
