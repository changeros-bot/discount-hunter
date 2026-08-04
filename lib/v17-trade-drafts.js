import { readV17AutoStore, taipeiDateKey, nowIso, writeV17AutoStore } from "./v17-auto-store";
import { evaluateTradeReadiness } from "./v17-risk-gate";

export const DRAFT_STATUSES = ["DRAFT", "CONFIRMED", "SKIPPED", "CANCELLED"];

function sameDraftDay(draft, candidate) {
  return taipeiDateKey(new Date(draft.createdAt || Date.now())) === taipeiDateKey()
    && String(draft.symbol || "").toUpperCase() === String(candidate.symbol || "").toUpperCase()
    && String(draft.tier || "").toUpperCase() === String(candidate.tier || "").toUpperCase();
}

export async function readTradeDrafts() {
  const drafts = await readV17AutoStore({ name: "drafts", fallback: [] });
  return Array.isArray(drafts) ? drafts : [];
}

export async function readTradeDraftById(draftId) {
  const drafts = await readTradeDrafts();
  return drafts.find((draft) => draft.id === draftId) || null;
}

export async function writeTradeDrafts(drafts) {
  return writeV17AutoStore({ name: "drafts", value: Array.isArray(drafts) ? drafts : [] });
}

export function buildDraftId(candidate, date = new Date()) {
  const dateKey = taipeiDateKey(date).replace(/-/g, "");
  return `DRAFT-${dateKey}-${candidate.symbol}-${candidate.tier}`;
}

export async function createTradeDraft({ decisions = [], candidate = null } = {}) {
  const readiness = await evaluateTradeReadiness({ decisions, candidate });
  if (readiness.status !== "READY") {
    return { created: false, blocked: true, readiness };
  }

  const drafts = await readTradeDrafts();
  const existing = drafts.find((draft) => sameDraftDay(draft, readiness.candidate));
  if (existing) {
    return { created: false, duplicate: true, draft: existing, readiness };
  }

  const createdAt = nowIso();
  const draft = {
    id: buildDraftId(readiness.candidate, new Date()),
    symbol: readiness.candidate.symbol,
    tier: readiness.candidate.tier,
    amountUSDT: readiness.candidate.amountUSDT,
    trigger: "drawdown_from_v17_decision_engine",
    drawdown: readiness.candidate.drawdown,
    price: readiness.candidate.price,
    status: "DRAFT",
    mode: readiness.mode,
    riskStatus: "PASS",
    createdAt,
    updatedAt: createdAt,
    userAction: null,
    dryRunOnly: true,
  };

  const storage = await writeTradeDrafts([draft, ...drafts]);
  return { created: true, draft, readiness, storage };
}

export async function updateDraftStatus({ draftId, status, userAction = null }) {
  if (!DRAFT_STATUSES.includes(status)) throw new Error(`invalid_draft_status:${status}`);
  const drafts = await readTradeDrafts();
  const index = drafts.findIndex((draft) => draft.id === draftId);
  if (index < 0) throw new Error(`draft_not_found:${draftId}`);
  const currentStatus = String(drafts[index].status || "").toUpperCase();
  if (currentStatus === status) {
    return { draft: drafts[index], drafts, storage: { store: "unchanged" }, duplicate: true };
  }
  if (currentStatus !== "DRAFT") {
    throw new Error(`invalid_draft_transition:${currentStatus}->${status}`);
  }
  const updatedAt = nowIso();
  drafts[index] = { ...drafts[index], status, userAction, updatedAt };
  const storage = await writeTradeDrafts(drafts);
  return { draft: drafts[index], drafts, storage, duplicate: false };
}
