import { createRequire } from "module";
import { getMarket91Shortlist } from "./v17-market-91-shortlist";

const require = createRequire(import.meta.url);

function normalize(symbol) {
  const raw = String(symbol || "").trim();
  if (/on$/.test(raw) && raw.length > 2) return raw.slice(0, -2).toUpperCase();
  return raw.toUpperCase();
}

function rowsFromModule(mod, sourceFile) {
  const rows = [];
  for (const value of Object.values(mod || {})) {
    if (Array.isArray(value)) rows.push(...value);
    if (typeof value === "function") {
      try {
        const result = value();
        if (Array.isArray(result?.rows)) rows.push(...result.rows);
      } catch {
        // ignore unsafe export
      }
    }
  }
  return rows.filter((row) => row && row.symbol).map((row) => ({ ...row, sourceFile }));
}

function loadRequired(file) {
  try {
    return require(`./${file}`);
  } catch {
    return null;
  }
}

function loadBatchRows() {
  const reviewedFiles = [
    "v17-market-91-fifth-batch.js",
    "v17-market-91-eighth-batch.js",
    "v17-market-91-eleventh-batch.js",
    "v17-market-91-fifteenth-batch.js",
    "v17-market-91-sixteenth-batch.js",
    "v17-market-91-eighteenth-batch.js",
  ];

  const rows = [];
  for (const file of reviewedFiles) {
    const mod = loadRequired(file);
    if (mod) rows.push(...rowsFromModule(mod, file));
  }

  const completion = loadRequired("v17-market-91-original-missing-completion.js");
  if (completion) {
    rows.push(...rowsFromModule(completion, "v17-market-91-original-missing-completion.js"));
  }

  return rows;
}

function classifyExcluded(row) {
  const status = `${row.tier || ""} ${row.status || ""}`;
  const text = `${status} ${row.risk || ""} ${row.reason || ""} ${row.rule || ""} ${row.blocker || ""}`;
  const score = Number(row.totalScore ?? row.score ?? 0);

  if (/PENDING|CANDIDATE_ONLY|待驗證|pending/i.test(status)) {
    return {
      auditCategory: "尚未排到 / 待補驗證",
      auditCode: "NOT_YET_REVIEWED_OR_PENDING_EVIDENCE",
      auditReason: "有研究價值或候選敘事，但尚未進入 Market45 主收斂池，需補來源驗證或 18 分 Gate。",
    };
  }

  if (/SECOND_REVIEW|RESERVE|二審|只能人工研究|週期|能源|鋼鐵/i.test(status)) {
    return {
      auditCategory: "有訊號但分數 / 風險不足",
      auditCode: "SECOND_REVIEW_NOT_MARKET45_CORE",
      auditReason: "有回測或主題訊號，但屬二審、週期、工具或低權重研究，不進 Market45 主池。",
    };
  }

  if (/OBJECTIVE_RISK_BLOCKED|INVERSE_LEVERAGED|INVERSE_ETF|CASH_TOOL|BOND|CLO|TBILL|(^|_)ETF($|_)|COMMODITY_ROLL|SECTOR_ETF|COUNTRY_ETF/i.test(status)) {
    return {
      auditCategory: "連基本回測 / 主題門檻未觸發",
      auditCode: "STRUCTURAL_TOOL_OR_NON_EQUITY_EXCLUDED",
      auditReason: "屬 ETF、現金工具、反向槓桿、商品滾動或非單股品質候選，不進 Market45 主池。",
    };
  }

  if (/RESEARCH_POOL_ONLY|BLOCK|封鎖|block observation|block formal|不進正式觀察|不能進正式觀察/i.test(text) || (score > 0 && score < 70)) {
    return {
      auditCategory: "有訊號但分數 / 風險不足",
      auditCode: "SIGNAL_BUT_SCORE_OR_RISK_FAILED",
      auditReason: "有研究訊號，但品質、風險、估值、產業或現金流條件不足，不進 Market45。",
    };
  }

  return {
    auditCategory: "連基本回測 / 主題門檻未觸發",
    auditCode: "BASIC_SIGNAL_NOT_TRIGGERED_OR_LOW_PRIORITY",
    auditReason: "目前資料未顯示足夠強的主題、回測或品質訊號進入 Market45，保留低優先級紀錄。",
  };
}

function summarize(rows) {
  return rows.reduce((acc, row) => {
    acc[row.auditCategory] = (acc[row.auditCategory] || 0) + 1;
    return acc;
  }, {});
}

function rowScore(row) {
  const score = Number(row?.totalScore ?? row?.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function sourcePriority(row) {
  const file = String(row?.sourceFile || "");
  if (/original-missing-completion/.test(file)) return 1;
  return 2;
}

export function getMarket91AuditTrail() {
  const market45 = new Map((getMarket91Shortlist().rows || []).map((row) => [normalize(row.symbol), row]));
  const rawRows = loadBatchRows();
  const deduped = new Map();

  for (const row of rawRows) {
    const key = normalize(row.symbol);
    if (!key || market45.has(key)) continue;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, row);
      continue;
    }
    const nextRank = sourcePriority(row) * 1000 + rowScore(row);
    const oldRank = sourcePriority(existing) * 1000 + rowScore(existing);
    if (nextRank > oldRank) deduped.set(key, row);
  }

  const excluded = [...deduped.values()]
    .sort((a, b) => {
      const priorityDelta = sourcePriority(b) - sourcePriority(a);
      if (priorityDelta !== 0) return priorityDelta;
      const scoreDelta = rowScore(b) - rowScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return normalize(a.symbol).localeCompare(normalize(b.symbol));
    })
    .map((row) => ({
      symbol: normalize(row.symbol),
      name: row.name || row.symbol,
      sourceFile: row.sourceFile || null,
      tier: row.tier || row.status || "UNCLASSIFIED",
      score: row.totalScore ?? row.score ?? null,
      reason: row.reason || row.thesis || row.note || row.tag || "原始91檔補齊紀錄，待後續官方來源驗證。",
      risk: row.risk || row.blocker || row.reason || "未提供風險",
      ...classifyExcluded(row),
    }));

  const missingSlots = Math.max(0, 46 - excluded.length);
  const overflow = excluded.length > 46 ? excluded.slice(46) : [];
  const rows = excluded.slice(0, 46);

  for (let i = 1; i <= missingSlots; i += 1) {
    rows.push({
      symbol: `UNRESOLVED-${i}`,
      name: "未回填原始91檔紀錄",
      sourceFile: null,
      tier: "UNRESOLVED_AUDIT_SLOT",
      score: null,
      reason: "原始91檔完整清單尚未在 repo 中形成單一可追溯資料源，需回填。",
      risk: "audit trail incomplete",
      auditCategory: "尚未排到 / 待補驗證",
      auditCode: "MISSING_ORIGINAL_91_SOURCE_ROW",
      auditReason: "這不是判定不合格，而是原始91檔來源資料缺口；需補回當初候選來源與排除理由。",
    });
  }

  return {
    ok: true,
    version: "v17-market-91-audit-trail-v4-classification-fixed",
    totalOriginalTarget: 91,
    market45Count: 45,
    auditTarget: 46,
    auditCovered: rows.filter((row) => !row.symbol.startsWith("UNRESOLVED-")).length,
    unresolvedCount: rows.filter((row) => row.symbol.startsWith("UNRESOLVED-")).length,
    overflowCount: overflow.length,
    closedLoop: rows.length === 46 && rows.every((row) => !row.symbol.startsWith("UNRESOLVED-")),
    categories: summarize(rows),
    rows,
    overflow,
    auditNotes: [
      "46 檔 audit trail 已補齊：先採已審核 batch 紀錄，再用 original missing completion rows 補齊原始91宇宙缺口。",
      "補齊列仍是 observation/audit 記錄，不是買入、不給 DCA、不給半自動、不給白名單。",
      "overflow 代表 repo 裡還有額外 expansion/補充列，不屬本次 46 檔主審核清單。",
      "分類規則已修正：RESERVE / SECOND_REVIEW 優先歸入『有訊號但分數 / 風險不足』，避免 BABA 這類二審股被誤歸到結構性工具排除。",
    ],
    rule: "91→45 audit trail 必須區分：未觸發基本訊號、訊號存在但分數/風險不足、尚未排到/待補驗證。不得用單一『未通過』掩蓋不同淘汰原因。",
  };
}
