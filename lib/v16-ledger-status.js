function normalizeSignalLevel(signalLevel) {
  const level = Number(signalLevel || 0);
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(4, Math.floor(level)));
}

function ledgerStatusText(doneTiers = [], signalLevel = 0) {
  const done = Array.isArray(doneTiers) ? doneTiers : [];
  const reachedLevel = normalizeSignalLevel(signalLevel);
  const reached = Array.from({ length: reachedLevel }, (_, i) => `D${i + 1}`);
  const pending = reached.filter((tier) => !done.includes(tier));

  const parts = [];
  if (done.length) parts.push(`已登帳：${done.join("、")}`);
  if (pending.length) parts.push(`待補登：${pending.join("、")}`);

  return parts.length ? parts.join("｜") : "尚未登帳";
}

module.exports = {
  ledgerStatusText,
};
