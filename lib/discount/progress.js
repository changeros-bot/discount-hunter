function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

function getSignalLevel(asset) {
  return asset?.signal?.level || 0;
}

function getRuleDepths(asset) {
  return (asset?.rules || []).map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);
}

function getLevelProgress(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset?.discount));
  const ruleDepths = getRuleDepths(asset);
  const amounts = asset?.amounts || [];
  const level = getSignalLevel(asset);

  if (!Number.isFinite(currentDepth) || !ruleDepths.length) {
    return {
      fromText: "--",
      toText: "--",
      stageText: "資料未就緒",
      progress: 0,
      displayProgress: 0,
      remainingDepth: null,
      completed: false,
    };
  }

  if (level <= 0) {
    const targetDepth = ruleDepths[0];
    const progress = targetDepth > 0 ? Math.min(99, Math.max(0, (currentDepth / targetDepth) * 100)) : 0;
    return {
      fromText: "0U",
      toText: `${amounts[0] || 0}U`,
      stageText: `尚未到買點 → ${levelNames[1]}`,
      progress,
      displayProgress: Math.floor(progress),
      remainingDepth: Math.max(0, targetDepth - currentDepth),
      completed: false,
    };
  }

  if (level >= ruleDepths.length) {
    return {
      fromText: `${amounts[level - 1] || 0}U`,
      toText: "最深層",
      stageText: `${levelNames[level]} 已觸發`,
      progress: 100,
      displayProgress: 100,
      remainingDepth: 0,
      completed: true,
    };
  }

  const startDepth = ruleDepths[level - 1];
  const targetDepth = ruleDepths[level];
  const span = Math.max(0.000001, targetDepth - startDepth);
  const progress = Math.min(100, Math.max(0, ((currentDepth - startDepth) / span) * 100));

  return {
    fromText: `${amounts[level - 1] || 0}U`,
    toText: `${amounts[level] || 0}U`,
    stageText: `${levelNames[level]} → ${levelNames[level + 1]}`,
    progress,
    displayProgress: Math.floor(progress),
    remainingDepth: Math.max(0, targetDepth - currentDepth),
    completed: false,
  };
}

module.exports = {
  getLevelProgress,
};
