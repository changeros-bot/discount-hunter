import { createRequire } from "module";

const require = createRequire(import.meta.url);

const PENDING_EVIDENCE = [
  {
    symbol: "QCOM",
    evidenceStatus: "VERIFIED_WITH_HANDSET_CYCLE_RISK_REVIEWED",
    sourceStatus: "BATCH_VERIFIED_FOR_PAPER_TEST_WITH_SEMI_RISK_FLAG",
    status: "BATCH_VERIFIED_QCOM_PAPER_TEST_APPROVED_HANDSET_RISK_NOT_BLOCKER",
    tag: "批次驗證通過 / 手機週期已審 / 7天紙上",
    decision: "QCOM 通過批次驗證：手機週期與 Q3 guidance 風險已列入風險旗標，但被判定為需追蹤風險，不是硬性 Blocker；Auto / IoT / Edge AI 延伸足以進 7 天小額紙上交易；不得進真實交易。",
    blocker: null,
    riskFlag: "手機出貨、授權收入、QCT handset、Android OEM 需求與 Q3 guidance 仍需追蹤；目前不構成硬性阻擋；紙上測試限 5U。",
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
    nextVerification: ["7 天紙上 PnL", "QCT handset trend", "Q3 guidance / Android OEM demand", "Auto / IoT growth", "QTL licensing stability"],
  },
  {
    symbol: "ORCL",
    evidenceStatus: "PUBLIC_RISK_BLOCK_PENDING_OFFICIAL_CONFIRMATION",
    sourceStatus: "PUBLIC_RISK_BLOCK",
    status: "PUBLIC_RISK_BLOCK_ORCL_AI_CAPEX_DEBT_FCF",
    tag: "公開風險已觸發封鎖",
    decision: "ORCL AI 雲端敘事強，但 capex / 債務 / 負自由現金流壓力過大；封鎖，不進正式觀察或紙上交易。",
    blocker: "AI capex 大幅擴張、融資與負自由現金流風險；估值故事不可蓋過現金流與資產負債表。",
    riskFlag: "RPO 強但 FCF 與融資壓力顯著。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方 FY2026 10-K", "capex guidance", "free cash flow", "debt / equity financing", "RPO quality and margin durability"],
  },
  {
    symbol: "NOW",
    evidenceStatus: "VERIFIED",
    sourceStatus: "BATCH_VERIFIED_FOR_PAPER_TEST",
    status: "BATCH_VERIFIED_NOW_PAPER_TEST_APPROVED",
    tag: "批次驗證通過 / 7天紙上",
    decision: "NOW 通過批次驗證：企業軟體品質與 RPO / workflow AI 敘事可進 7 天紙上交易；高估值仍禁止真實交易。",
    blocker: null,
    riskFlag: "高估值 SaaS；若 RPO / margin / AI 變現不足，紙上後退回觀察。",
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
    nextVerification: ["7 天紙上 PnL", "subscription revenue growth", "current RPO", "operating margin / FCF margin"],
  },
  {
    symbol: "META",
    evidenceStatus: "RISK_BLOCK",
    sourceStatus: "PUBLIC_AI_CAPEX_RISK_BLOCK",
    status: "PUBLIC_RISK_BLOCK_META_AI_CAPEX_REALITY_LABS",
    tag: "AI capex / Reality Labs 封鎖",
    decision: "META 平台品質強，但 AI capex、Reality Labs、能源與基礎設施支出風險太大；封鎖，不進紙上交易。",
    blocker: "AI infrastructure spending / Reality Labs losses may pressure future FCF.",
    riskFlag: "AI capex 支出過重，不能用平台敘事蓋過現金流風險。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["capex guide", "Reality Labs losses", "ad revenue growth", "FCF durability"],
  },
  {
    symbol: "HUBB",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE_OVERLAY_AVAILABLE",
    status: "EVIDENCE_PENDING_OVERLAY_AVAILABLE",
    tag: "有獨立官方驗證模組",
    decision: "已存在 HUBB official verification overlay；最終判斷以 HUBB 官方驗證模組覆蓋。",
    blocker: null,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["讀取 v17-market-91-hubb-official-verification.js", "確認 NSI / debt follow-up risk"],
  },
  {
    symbol: "NET",
    evidenceStatus: "RISK_BLOCK",
    sourceStatus: "HIGH_VALUATION_VOLATILITY_BLOCK",
    status: "RISK_BLOCK_NET_VALUATION_VOLATILITY_FCF",
    tag: "高估值 / 高波動封鎖",
    decision: "NET 成長敘事強，但估值、波動與 FCF 成熟度不足；封鎖，不進紙上交易。",
    blocker: "高估值、高波動、FCF margin 與大客戶成長需更強證據。",
    riskFlag: "DBNR、FCF margin、large customer growth 未強到可以進紙上測試。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["revenue growth", "dollar-based net retention", "FCF margin", "large customer growth"],
  },
  {
    symbol: "REGN",
    evidenceStatus: "FORMAL_ONLY_VERIFIED_PENDING_BIOTECH_MODULE_REVIEW",
    sourceStatus: "BATCH_VERIFIED_FORMAL_ONLY_PENDING_BIOTECH_MODULE",
    status: "BATCH_VERIFIED_REGN_FORMAL_ONLY_EYLEA_RISK_PENDING_BIOTECH_MODULE",
    tag: "正式觀察 / 待生技模組覆核",
    decision: "REGN 暫列正式觀察，但不是生技專用模組最終通過；需以專利到期、pipeline、FDA / clinical catalyst、EYLEA / EYLEA HD、Dupixent 集中度重做覆核；覆核前不得進紙上交易。",
    blocker: null,
    riskFlag: "Dupixent 強，但 EYLEA / pipeline / 專利與集中度需追蹤；待生技模組覆核。",
    permissions: { paperTrading: false, formalObservation: true, realAutoTrade: false },
    nextVerification: ["Biotech module review", "EYLEA / EYLEA HD trend", "Dupixent contribution", "pipeline catalysts", "patent cliff / concentration risk", "FDA / clinical readout calendar"],
  },
  {
    symbol: "UNH",
    evidenceStatus: "FORMAL_ONLY_VERIFIED_PENDING_HEALTH_INSURER_MODULE_REVIEW",
    sourceStatus: "BATCH_VERIFIED_FORMAL_ONLY_PENDING_HEALTH_INSURER_MODULE",
    status: "BATCH_VERIFIED_UNH_FORMAL_ONLY_MLR_REGULATORY_PENDING_HEALTH_INSURER_MODULE",
    tag: "正式觀察 / 待醫保模組覆核",
    decision: "UNH 暫列正式觀察，但不是醫療保險專用模組最終通過；需以 MLR、Medicare / Medicaid、Optum、guidance、監管 / DOJ / 政策風險重做覆核；覆核前不得進紙上交易。",
    blocker: null,
    riskFlag: "MLR、Medicare / DOJ / regulatory risk、Optum trend 需持續追蹤；待醫保模組覆核。",
    permissions: { paperTrading: false, formalObservation: true, realAutoTrade: false },
    nextVerification: ["Health insurer module review", "medical loss ratio", "guidance change", "Medicare / Medicaid exposure", "regulatory / DOJ risk", "Optum growth"],
  },
  {
    symbol: "DELL",
    evidenceStatus: "FORMAL_ONLY_VERIFIED",
    sourceStatus: "BATCH_VERIFIED_FORMAL_ONLY",
    status: "BATCH_VERIFIED_DELL_FORMAL_ONLY_AI_SERVER_MARGIN",
    tag: "批次驗證 / 正式觀察，不紙上",
    decision: "DELL AI server 敘事與需求明確，可列正式觀察；但 margin、backlog quality、cash conversion 未完全證明，不進紙上交易。",
    blocker: null,
    riskFlag: "AI server demand positive, but profitability / backlog quality / cash conversion must be proven.",
    permissions: { paperTrading: false, formalObservation: true, realAutoTrade: false },
    nextVerification: ["AI server backlog", "server margin", "PC demand cycle", "cash conversion"],
  },
];

function normalize(symbol) {
  const raw = String(symbol || "").trim();
  if (/on$/.test(raw) && raw.length > 2) return raw.slice(0, -2).toUpperCase();
  return raw.toUpperCase();
}

function loadHubbOfficialVerification() {
  try {
    const mod = require("./v17-market-91-hubb-official-verification.js");
    const value = mod.getHubbOfficialVerification?.() || mod.HUBB_OFFICIAL_VERIFICATION;
    return value?.symbol ? value : null;
  } catch {
    return null;
  }
}

export function getMarket45EvidenceRegistry() {
  const rows = [...PENDING_EVIDENCE];
  const hubb = loadHubbOfficialVerification();
  if (hubb) {
    const index = rows.findIndex((row) => normalize(row.symbol) === normalize(hubb.symbol));
    const overlay = {
      symbol: hubb.symbol,
      evidenceStatus: hubb.sourceStatus,
      sourceStatus: hubb.sourceStatus,
      status: hubb.status,
      tag: hubb.tag,
      decision: hubb.decision,
      blocker: hubb.blocker,
      officialEvidence: hubb.officialEvidence,
      verifiedScore: hubb.verifiedScore,
      confidence: hubb.confidence,
      permissions: hubb.permissions,
      nextVerification: hubb.nextVerification,
      sourceModule: "v17-market-91-hubb-official-verification.js",
    };
    if (index >= 0) rows[index] = { ...rows[index], ...overlay };
    else rows.push(overlay);
  }
  return {
    version: "v17-market-45-evidence-registry-v5-normalized-symbols",
    updatedAt: new Date().toISOString(),
    total: rows.length,
    rows,
  };
}

export function getMarket45EvidenceMap() {
  const registry = getMarket45EvidenceRegistry();
  return new Map(registry.rows.map((row) => [normalize(row.symbol), row]));
}
