export function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--";
}

export function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--";
}

export function statusLabel(status) {
  const map = {
    queued: "待買入",
    partial: "部分完成｜金額不足",
    suspect: "疑似已買｜待價格確認",
    mismatch: "不符合建議",
    failed: "執行失敗｜回到佇列",
    complete: "已完成",
    none: "尚未達買點",
    review_only: "僅檢視"
  };
  return map[status] || status || "未知";
}

export function statusTone(status) {
  if (status === "queued") return "action";
  if (status === "partial" || status === "suspect") return "warning";
  if (status === "mismatch" || status === "failed") return "danger";
  if (status === "complete") return "done";
  return "idle";
}

export function adaptActionToCard(action) {
  const summary = action?.eventSummary || {};
  return {
    key: action?.actionId || `${action?.symbol || "UNKNOWN"}-${action?.tier || "N"}`,
    symbol: action?.symbol,
    name: action?.name,
    status: action?.status,
    statusLabel: statusLabel(action?.status),
    tone: statusTone(action?.status),
    tier: action?.tier,
    level: action?.level,
    price: action?.price,
    high: action?.high,
    discount: action?.discount,
    rule: action?.rule,
    amount: action?.amount,
    amountText: money(action?.amount),
    discountText: pct(action?.discount),
    ruleText: pct(action?.rule),
    requiredAmount: summary.requiredAmount ?? action?.amount ?? 0,
    filledAmount: summary.totalAmount ?? 0,
    requiredText: money(summary.requiredAmount ?? action?.amount ?? 0),
    filledText: money(summary.totalAmount ?? 0),
    amountLow: Boolean(summary.amountLow),
    amountHigh: Boolean(summary.amountHigh),
    reason: action?.reason,
    shouldNotify: Boolean(action?.shouldNotify),
    updatedAt: action?.decidedAt
  };
}

export function adaptV17DecisionResult(result = {}) {
  const cards = (result.actionQueue || []).map(adaptActionToCard);
  return {
    ok: Boolean(result.ok),
    version: result.version,
    updatedAt: result.updatedAt,
    cards,
    summary: {
      actionCount: cards.length,
      notifyCount: Number(result.notifyCount || 0),
      totalAmount: cards.reduce((sum, card) => sum + Number(card.amount || 0), 0),
      totalAmountText: money(cards.reduce((sum, card) => sum + Number(card.amount || 0), 0))
    }
  };
}
