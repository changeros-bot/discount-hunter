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

function hasBlocker(row) {
  const text = `${row?.status || ""} ${row?.risk || ""} ${row?.blocker || ""} ${row?.decision || ""} ${row?.reason || ""} ${row?.rule || ""}`;
  return /BLOCK|封鎖|阻擋|硬傷|禁止|缺資料|來源不足|財務疑慮|現金流疑慮|debt|cash flow/i.test(text);
}

function evidenceState(row) {
  const text = `${row?.quality || ""} ${row?.sourceStatus || ""} ${row?.evidenceStatus || ""} ${row?.status || ""}`;
  if (/VERIFIED|EVIDENCE_PASS|SOURCE_VERIFIED|OFFICIAL_VERIFIED|通過驗證/i.test(text)) return "VERIFIED";
  if (/PENDING|DRAFT|未驗證|待驗證/i.test(text)) return "PENDING";
  return "PENDING";
}

function mark(row, finalBucket, finalDecision, extra = {}) {
  return {
    ...row,
    finalBucket,
    finalDecision,
    finalScreened: true,
    evidenceState: extra.evidenceState || evidenceState(row),
    hasBlocker: extra.hasBlocker ?? hasBlocker(row),
    canEnterPaperTrading: finalBucket === "紙上交易測試",
    canEnterV17LongWatch: finalBucket === "紙上交易測試" || finalBucket === "正式觀察",
    canEnterRealAutoTrade: false,
    realTradeBlockedReason: "Market45 最終篩選只允許觀察與紙上交易；禁止真實自動交易。",
    ...extra,
  };
}

function paperEligible(row) {
  const score = scoreOf(row);
  return row?.quality === "PASSED_DRAFT" && score >= 15 && !hasBlocker(row);
}

function formalEligible(row) {
  const score = scoreOf(row);
  return (row?.quality === "PASSED_DRAFT" || row?.tier === "DEEP_REVIEW") && score >= 12 && !hasBlocker(row);
}

export function finalizeMarket45Review(review) {
  const buckets = review?.buckets || {};
  const allRows = [
    ...(buckets["紙上交易候選"] || []),
    ...(buckets["正式觀察"] || []),
    ...(buckets["次級觀察"] || []),
    ...(buckets["工具股_題材股"] || []),
    ...(buckets["封鎖"] || []),
  ];
  const deduped = [];
  const seen = new Set();
  for (const row of sortByQuality(allRows)) {
    const key = symbolKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const finalPaper = [];
  const finalFormal = [];
  const finalSecondary = [];
  const finalToolOnly = [];
  const finalBlocked = [];

  for (const row of deduped) {
    const eState = evidenceState(row);
    const blocked = hasBlocker(row);
    const bucketText = `${row.bucket || ""} ${row.proposedRole || ""} ${row.proposedRule || ""} ${row.rule || ""}`;

    if (blocked) {
      finalBlocked.push(mark(row, "封鎖", "有 Blocker 或硬傷；不進正式觀察、不進紙上交易。", { hasBlocker: true, evidenceState: eState }));
      continue;
    }

    if (paperEligible(row)) {
      finalPaper.push(mark(row, "紙上交易測試", "通過 Quality 門檻，列入 7 天紙上交易測試；仍禁止真實交易。", { evidenceState: eState }));
      continue;
    }

    if (formalEligible(row)) {
      finalFormal.push(mark(row, "正式觀察", "達到正式觀察門檻；若 Evidence 仍是 pending，不得升級為紙上交易或真倉。", { evidenceState: eState }));
      continue;
    }

    if (/能源|油氣|天然氣|鋼鐵|週期|ETF|工具/.test(bucketText)) {
      finalToolOnly.push(mark(row, "工具股 / 題材股", "工具型或題材型標的；只能人工研究，不進自動化。", { evidenceState: eState }));
      continue;
    }

    finalSecondary.push(mark(row, "次級觀察", "未達正式觀察 / 紙上交易門檻；保留研究，不進自動化。", { evidenceState: eState }));
  }

  const finalMissing = buckets["缺資料"] || [];
  const ranked = (rows) => sortByQuality(rows).map((row, index) => ({ ...row, finalRank: index + 1 }));
  const finalBuckets = {
    "紙上交易測試": ranked(finalPaper),
    "正式觀察": ranked(finalFormal),
    "次級觀察": ranked(finalSecondary),
    "工具股_題材股": ranked(finalToolOnly),
    "封鎖": ranked(finalBlocked),
    "缺資料": finalMissing,
  };

  const sourceComplete = Number(review?.covered || 0) === 45 && Number(review?.missingCount || 0) === 0;
  const completed = sourceComplete;

  return {
    ...review,
    status: completed ? "final_screened" : review?.status,
    finalScreened: completed,
    finalUpdatedAt: new Date().toISOString(),
    finalRules: {
      totalTarget: 45,
      paperTradingTarget: "浮動：符合門檻幾檔就是幾檔，不湊數",
      formalWatchTarget: "浮動：符合門檻幾檔就是幾檔，不硬砍",
      paperTradingDays: 7,
      paperQualityGate: "quality = PASSED_DRAFT 且 score >= 15 且沒有 Blocker",
      formalWatchGate: "quality = PASSED_DRAFT 或 DEEP_REVIEW，score >= 12，且沒有 Blocker",
      realAutoTradeAllowed: false,
      rule: "Market45 最終分類由分數、Quality Gate、Evidence 狀態與 Blocker 決定；5 檔 / 10 檔只是目標範圍，不是硬性配額。",
    },
    finalSummary: Object.fromEntries(Object.entries(finalBuckets).map(([key, rows]) => [key, rows.length])),
    finalBuckets,
    completionText: completed
      ? `Market45 已完成門檻式最終篩選：紙上交易 ${finalBuckets["紙上交易測試"].length} 檔，正式觀察 ${finalBuckets["正式觀察"].length} 檔；沒有為了湊數硬拉標的。`
      : "Market45 尚未達到資料完整條件。",
  };
}
