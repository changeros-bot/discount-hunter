import { createRequire } from "module";
import { getMarket91Shortlist } from "./v17-market-91-shortlist";

const require = createRequire(import.meta.url);

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
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

function loadBatchRows() {
  const files = [
    "v17-market-91-fifth-batch.js",
    "v17-market-91-eighth-batch.js",
    "v17-market-91-eleventh-batch.js",
    "v17-market-91-fifteenth-batch.js",
    "v17-market-91-sixteenth-batch.js",
    "v17-market-91-eighteenth-batch.js",
  ];
  const rows = [];
  for (const file of files) {
    try {
      rows.push(...rowsFromModule(require(`./${file}`), file));
    } catch {
      // ignored: audit still reports loaded rows
    }
  }
  return rows;
}

function classifyExcluded(row) {
  const text = `${row.tier || ""} ${row.status || ""} ${row.risk || ""} ${row.reason || ""} ${row.rule || ""}`;
  const score = Number(row.totalScore ?? row.score ?? 0);

  if (/PENDING|CANDIDATE_ONLY|待驗證|pending/i.test(text)) {
    return {
      auditCategory: "尚未排到 / 待補驗證",
      auditCode: "NOT_YET_REVIEWED_OR_PENDING_EVIDENCE",
      auditReason: "有研究價值或候選敘事，但尚未進入 Market45 主收斂池，需補來源驗證或 18 分 Gate。",
    };
  }

  if (/RESEARCH_POOL_ONLY|BLOCK|封鎖|block observation|block formal|不進正式觀察|不能進正式觀察/i.test(text) || (score > 0 && score < 70)) {
    return {
      auditCategory: "有訊號但分數 / 風險不足",
      auditCode: "SIGNAL_BUT_SCORE_OR_RISK_FAILED",
      auditReason: "有研究訊號，但品質、風險、估值、產業或現金流條件不足，不進 Market45。",
    };
  }

  if (/SECOND_REVIEW|RESERVE|二審|只能人工研究|週期|ETF|能源|鋼鐵/i.test(text)) {
    return {
      auditCategory: "有訊號但分數 / 風險不足",
      auditCode: "SECOND_REVIEW_NOT_MARKET45_CORE",
      auditReason: "有回測或主題訊號，但屬二審、週期、工具或低權重研究，不進 Market45 主池。",
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

export function getMarket91AuditTrail() {
  const market45 = new Map((getMarket91Shortlist().rows || []).map((row) => [normalize(row.symbol), row]));
  const rawRows = loadBatchRows();
  const deduped = new Map();

  for (const row of rawRows) {
    const key = normalize(row.symbol);
    if (!key || market45.has(key)) continue;
    const existing = deduped.get(key);
    const nextScore = Number(row.totalScore ?? row.score ?? 0);
    const oldScore = Number(existing?.totalScore ?? existing?.score ?? 0);
    if (!existing || nextScore > oldScore) deduped.set(key, row);
  }

  const excluded = [...deduped.values()].map((row) => ({
    symbol: normalize(row.symbol),
    name: row.name || row.symbol,
    sourceFile: row.sourceFile || null,
    tier: row.tier || row.status || "UNCLASSIFIED",
    score: row.totalScore ?? row.score ?? null,
    reason: row.reason || row.thesis || row.note || "未提供原始理由",
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
    version: "v17-market-91-audit-trail-v1",
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
    rule: "91→45 audit trail 必須區分：未觸發基本訊號、訊號存在但分數/風險不足、尚未排到/待補驗證。不得用單一『未通過』掩蓋不同淘汰原因。",
  };
}
