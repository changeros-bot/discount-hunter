import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { adaptActionToCard } from "../../../lib/v17-ui-adapter";
import { V17_STORAGE_KEYS, readV17State } from "../../../lib/v17-storage";

const ACTION_GATE = {
  BTC: { label: "通過", bucket: "BTC DCA", actionGate: "Discount Add Allowed", allowAction: true, reason: "BTC 是獨立加密資產折價系統；不屬 Market 91，但仍需人工確認。" },
  QQQON: { label: "觀察", bucket: "Fubon DCA Mirror", actionGate: "Watch Only", allowAction: false, reason: "QQQ/QQQM 長期 DCA 屬富邦主系統；Market 91 不處理 ETF 核心 DCA。" },
  NVDAON: { label: "通過", bucket: "AI Core / Satellite", actionGate: "Discount Add Allowed", allowAction: true, reason: "僅在折價觸發、thesis 沒壞、現金與倉位上限通過後允許加碼。" },
  TSMON: { label: "通過", bucket: "AI Core / Satellite", actionGate: "Discount Add Allowed", allowAction: true, reason: "僅在折價觸發、thesis 沒壞、現金與倉位上限通過後允許加碼。" },
  AVGOON: { label: "通過", bucket: "AI Core / Satellite", actionGate: "Discount Add Allowed", allowAction: true, reason: "僅在折價觸發、thesis 沒壞、現金與倉位上限通過後允許加碼。" },
  GOOGLON: { label: "通過", bucket: "AI Core / Satellite", actionGate: "Discount Add Allowed", allowAction: true, reason: "僅在折價觸發、thesis 沒壞、現金與倉位上限通過後允許加碼。" },
  AMDON: { label: "通過", bucket: "AI Core / Satellite", actionGate: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；資金不足時低於更高優先序標的。" },
  MRVLON: { label: "通過", bucket: "Discount Buy Candidate", actionGate: "Discount Add Allowed", allowAction: true, reason: "Discount Buy Candidate；只在折價觸發與 thesis 沒壞時允許人工確認。" },
  RKLBON: { label: "觀察", bucket: "Watch Only", actionGate: "Watch Only", allowAction: false, reason: "目前只觀察；除非重新升級，不進入可加碼清單。" },
  SPCXON: { label: "新上市觀察", bucket: "Discount Buy Candidate", actionGate: "No Action", allowAction: false, reason: "新上市 / 歷史不足；逢低必須人工確認資料源與上市以來高點。" },
};

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function keyOf(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function actionGateFor(card) {
  const key = keyOf(card.symbol);
  const gate = ACTION_GATE[key] || { label: "資料待確認", bucket: "Unknown", actionGate: "No Action", allowAction: false, reason: "Action Gate 未建檔，不進入可加碼清單。" };
  return { ...gate, symbol: card.symbol };
}
function buildCandidate(card, gate) {
  const amount = toNumber(card.amount, 0);
  const price = toNumber(card.price, 0);
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
    bucket: gate.bucket,
    actionGate: gate.actionGate,
    allowAction: Boolean(gate.allowAction && amount > 0 && price > 0),
    reason: gate.reason,
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
    const routed = cards.map((card) => {
      const gate = actionGateFor(card);
      return buildCandidate(card, gate);
    });
    const discountAddAllowed = routed.filter((x) => x.allowAction && x.actionGate === "Discount Add Allowed");
    const noAction = routed.filter((x) => !x.allowAction || x.actionGate !== "Discount Add Allowed");

    return res.status(200).json({
      ok: true,
      version: "v17-4-action-gate-compat-no-drafts",
      deprecatedEndpoint: true,
      replacement: "/api/v17/trade-readiness and Market 91 Action Gate",
      updatedAt: now,
      mode: "Market 91 v17.4 compatibility endpoint. No semi-auto drafts, no whitelist, no permission dry-run.",
      policy: "Universe Integrity → Strategy Bucket → Action Gate. Allowed outputs: No Action / Discount Add Allowed / Watch Only / Blocked.",
      discountAddAllowedCount: discountAddAllowed.length,
      noActionCount: noAction.length,
      totalCandidateAmountUsd: discountAddAllowed.reduce((sum, item) => sum + Number(item.amountUsd || 0), 0),
      safety: {
        autoTrade: false,
        createsDrafts: false,
        whitelist: false,
        requiresManualConfirmation: true,
        note: "This endpoint no longer creates order drafts. It only exposes Action Gate compatibility data for older UI callers.",
      },
      discountAddAllowed,
      noAction,
      legacyShape: {
        draftCount: 0,
        blockedCount: noAction.length,
        totalDraftAmountUsd: 0,
        drafts: [],
        blocked: noAction,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "action_gate_compat_failed" });
  }
}
