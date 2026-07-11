function scoreOf(row) {
  const score = Number(row?.totalScore ?? row?.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function symbolKey(row) {
  return String(row?.symbol || "").toUpperCase().replace(/ON$/, "");
}

function sortByQuality(rows = []) {
  return [...rows].sort((a, b) => {
    const scoreDelta = scoreOf(b) - scoreOf(a);
    if (scoreDelta !== 0) return scoreDelta;
    return String(a.symbol || "").localeCompare(String(b.symbol || ""));
  });
}

function mark(row, finalBucket, finalDecision, extra = {}) {
  return {
    ...row,
    finalBucket,
    finalDecision,
    finalScreened: true,
    canEnterPaperTrading: finalBucket === "紙上交易測試",
    canEnterV17LongWatch: finalBucket === "紙上交易測試" || finalBucket === "正式觀察",
    canEnterRealAutoTrade: false,
    realTradeBlockedReason: "Market45 最終篩選只允許觀察與紙上交易；禁止真實自動交易。",
    ...extra,
  };
}

export function finalizeMarket45Review(review) {
  const buckets = review?.buckets || {};
  const used = new Set();

  const paperRaw = sortByQuality(buckets["紙上交易候選"] || []);
  const finalPaper = paperRaw.slice(0, 5).map((row, index) => {
    used.add(symbolKey(row));
    return mark(row, "紙上交易測試", "入選 7 天紙上交易測試；不進真實交易。", { finalRank: index + 1 });
  });

  const formalPool = sortByQuality([
    ...(buckets["正式觀察"] || []),
    ...paperRaw.slice(5),
  ]).filter((row) => !used.has(symbolKey(row)));

  const finalFormal = formalPool.slice(0, 10).map((row, index) => {
    used.add(symbolKey(row));
    return mark(row, "正式觀察", "入選正式觀察；需完成來源驗證與 7 天測試後才可升級。", { finalRank: index + 1 });
  });

  const overflowFormal = formalPool.slice(10).map((row) => mark(row, "次級觀察", "正式觀察名額已滿，退回次級觀察。"));
  const finalSecondary = [
    ...overflowFormal,
    ...sortByQuality(buckets["次級觀察"] || []).filter((row) => !used.has(symbolKey(row))).map((row) => mark(row, "次級觀察", "保留研究，不進紙上交易。")),
  ];

  const finalToolOnly = sortByQuality(buckets["工具股_題材股"] || [])
    .filter((row) => !used.has(symbolKey(row)))
    .map((row) => mark(row, "工具股 / 題材股", "只能人工研究，不進自動化、不進紙上交易。"));

  const finalBlocked = sortByQuality(buckets["封鎖"] || [])
    .filter((row) => !used.has(symbolKey(row)))
    .map((row) => mark(row, "封鎖", "封鎖，不進折價獵人、不進紙上交易。"));

  const finalMissing = buckets["缺資料"] || [];
  const finalBuckets = {
    "紙上交易測試": finalPaper,
    "正式觀察": finalFormal,
    "次級觀察": finalSecondary,
    "工具股_題材股": finalToolOnly,
    "封鎖": finalBlocked,
    "缺資料": finalMissing,
  };

  const completed = Number(review?.covered || 0) === 45 && Number(review?.missingCount || 0) === 0 && finalPaper.length === 5 && finalFormal.length === 10;

  return {
    ...review,
    status: completed ? "final_screened" : review?.status,
    finalScreened: completed,
    finalUpdatedAt: new Date().toISOString(),
    finalRules: {
      totalTarget: 45,
      paperTradingTarget: 5,
      formalWatchTarget: 10,
      paperTradingDays: 7,
      realAutoTradeAllowed: false,
      rule: "45 檔收斂後，只准 5 檔進 7 天紙上交易、10 檔進正式觀察；其餘不進自動化。",
    },
    finalSummary: Object.fromEntries(Object.entries(finalBuckets).map(([key, rows]) => [key, rows.length])),
    finalBuckets,
    completionText: completed
      ? "Market45 已完成最終篩選：5 檔紙上交易測試、10 檔正式觀察、其餘保留研究或工具用途。"
      : "Market45 尚未達到完成條件。",
  };
}
