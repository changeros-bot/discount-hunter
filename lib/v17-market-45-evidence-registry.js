import { createRequire } from "module";

const require = createRequire(import.meta.url);

const PENDING_EVIDENCE = [
  {
    symbol: "QCOM",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "分數與 Quality 可列入候選，但尚未完成官方 Evidence Verification；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "需驗證手機週期、授權業務與非手機成長是否足以支撐折價候選。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / 10-K", "營收成長與授權業務風險", "手機週期與 AI PC / Auto 延伸是否有數據支持"],
  },
  {
    symbol: "ORCL",
    evidenceStatus: "PUBLIC_RISK_BLOCK_PENDING_OFFICIAL_CONFIRMATION",
    sourceStatus: "PUBLIC_RISK_BLOCK",
    status: "PUBLIC_RISK_BLOCK_ORCL_AI_CAPEX_DEBT_FCF",
    tag: "公開風險已觸發封鎖",
    decision: "ORCL AI 雲端敘事強，但公開資料已顯示 capex / 債務 / 負自由現金流壓力；在官方完整驗證前，直接封鎖，不進正式觀察或紙上交易。",
    blocker: "AI capex 大幅擴張、融資與負自由現金流風險；估值故事不可蓋過現金流與資產負債表。",
    riskFlag: "Reuters / IBD 類公開資料顯示 FY2027 capex 可能升至 90-95B、RPO 強但 FCF 與融資壓力顯著。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方 FY2026 10-K", "capex guidance", "free cash flow", "debt / equity financing", "RPO quality and margin durability"],
  },
  {
    symbol: "NOW",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "企業軟體品質高，但需驗證訂閱收入、RPO、margin、AI monetization；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "高估值 SaaS；若 RPO / margin / AI 變現不足，不能升級。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / shareholder letter", "subscription revenue growth", "current RPO", "operating margin / FCF margin"],
  },
  {
    symbol: "META",
    evidenceStatus: "PENDING_RISK_FLAG",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE_WITH_PUBLIC_AI_CAPEX_RISK",
    status: "EVIDENCE_PENDING_META_AI_CAPEX_RISK",
    tag: "待官方驗證 / AI capex 風險",
    decision: "META 平台與 AI 敘事強，但 AI capex、Reality Labs、能源與基礎設施支出壓力仍需官方驗證；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "AI infrastructure spending and Reality Labs losses may pressure future FCF; needs official capex / FCF confirmation.",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings release", "capex guide", "Reality Labs losses", "ad revenue growth", "FCF durability"],
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
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "雲端網路 / 安全敘事強，但需驗證營收成長、net retention、FCF 與估值承受力；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "高估值與高波動；需 DBNR、FCF margin、large customer growth 官方驗證。",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / shareholder letter", "revenue growth", "dollar-based net retention", "FCF margin", "large customer growth"],
  },
  {
    symbol: "REGN",
    evidenceStatus: "PENDING_RISK_FLAG",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE_WITH_EYLEA_RISK",
    status: "EVIDENCE_PENDING_REGN_EYLEA_PIPELINE_RISK",
    tag: "待官方驗證 / EYLEA 風險",
    decision: "REGN 品質高，但公開資料顯示 Dupixent 強、EYLEA 壓力仍在；需官方確認 pipeline、EYLEA HD、專利與集中度風險；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "Dupixent demand strong, but EYLEA weakness / transition and pipeline clarity require verification.",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings release", "EYLEA / EYLEA HD trend", "Dupixent contribution", "pipeline catalysts", "patent / concentration risk"],
  },
  {
    symbol: "UNH",
    evidenceStatus: "PENDING_RISK_FLAG",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE_WITH_REGULATORY_MLR_RISK",
    status: "EVIDENCE_PENDING_UNH_MLR_REGULATORY_RISK",
    tag: "待官方驗證 / 醫療成本與監管風險",
    decision: "UNH 防禦型品質仍需驗證；MLR、guidance、Optum、監管 / DOJ / Medicare 風險未清楚前，不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "MLR, guidance stability, Medicare / DOJ / regulatory risk and Optum trend need official confirmation.",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings release", "medical loss ratio", "guidance change", "regulatory / DOJ / Medicare risk", "Optum growth"],
  },
  {
    symbol: "DELL",
    evidenceStatus: "PENDING_RISK_FLAG",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE_WITH_AI_SERVER_MARGIN_RISK",
    status: "EVIDENCE_PENDING_DELL_AI_SERVER_MARGIN_CASH_CONVERSION",
    tag: "待官方驗證 / AI server margin",
    decision: "DELL AI server 敘事強、公開結果偏正面，但仍需官方驗證 AI server backlog 品質、margin、現金轉換與 PC 週期；不得進紙上交易或正式觀察。",
    blocker: null,
    riskFlag: "AI server demand positive, but profitability / backlog quality / cash conversion must be proven officially.",
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings deck", "AI server backlog", "server margin", "PC demand cycle", "cash conversion"],
  },
];

function normalize(symbol) {
  return String(symbol || "").toUpperCase().replace(/ON$/, "");
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
    version: "v17-market-45-evidence-registry-v2-risk-flags",
    updatedAt: new Date().toISOString(),
    total: rows.length,
    rows,
  };
}

export function getMarket45EvidenceMap() {
  const registry = getMarket45EvidenceRegistry();
  return new Map(registry.rows.map((row) => [normalize(row.symbol), row]));
}
