export const ORDER_STATUSES = Object.freeze({
  DRAFT: "DRAFT",
  AUTHORIZED: "AUTHORIZED",
  SUBMITTING: "SUBMITTING",
  SUBMITTED: "SUBMITTED",
  PARTIALLY_FILLED: "PARTIALLY_FILLED",
  FILLED: "FILLED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ["AUTHORIZED", "CANCELLED"],
  AUTHORIZED: ["SUBMITTING", "CANCELLED"],
  SUBMITTING: ["SUBMITTED", "PARTIALLY_FILLED", "FILLED", "REJECTED", "FAILED", "UNKNOWN"],
  SUBMITTED: ["PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "UNKNOWN"],
  PARTIALLY_FILLED: ["FILLED", "CANCELLED", "UNKNOWN"],
  UNKNOWN: ["SUBMITTED", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "FAILED"],
  FILLED: [],
  CANCELLED: [],
  REJECTED: [],
  FAILED: [],
});

export function normalizeOrderStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!Object.values(ORDER_STATUSES).includes(status)) throw new Error(`invalid_order_status:${value}`);
  return status;
}

export function canTransitionOrder(from, to) {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}

export function transitionOrderState(order, nextStatus, patch = {}) {
  const current = normalizeOrderStatus(order?.status || ORDER_STATUSES.DRAFT);
  const next = normalizeOrderStatus(nextStatus);
  if (!canTransitionOrder(current, next)) {
    throw new Error(`invalid_order_transition:${current}->${next}`);
  }
  return {
    ...order,
    ...patch,
    status: next,
    previousStatus: current,
    updatedAt: new Date().toISOString(),
  };
}

export function isTerminalOrderStatus(status) {
  return ["FILLED", "CANCELLED", "REJECTED", "FAILED"].includes(normalizeOrderStatus(status));
}

export function requiresOrderReconciliation(status) {
  return ["SUBMITTING", "SUBMITTED", "PARTIALLY_FILLED", "UNKNOWN"].includes(normalizeOrderStatus(status));
}
