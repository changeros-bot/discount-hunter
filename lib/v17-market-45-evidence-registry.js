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
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / 10-K", "營收成長與授權業務風險", "手機週期與 AI PC / Auto 延伸是否有數據支持"],
  },
  {
    symbol: "ORCL",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "雲端 / 資料庫敘事強，但正式升級前必須驗證負債、自由現金流、AI capex 與 remaining performance obligations 品質；不得進紙上交易或正式觀察。",
    blocker: null,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / 10-K", "自由現金流與 capex", "債務與利息費用", "RPO / Cloud growth 是否支持估值"],
  },
  {
    symbol: "NOW",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "企業軟體品質高，但需驗證訂閱收入、RPO、margin、AI monetization；不得進紙上交易或正式觀察。",
    blocker: null,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / shareholder letter", "subscription revenue growth", "current RPO", "operating margin / FCF margin"],
  },
  {
    symbol: "META",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "AI / 大型平台敘事強，但需驗證 capex、Reality Labs、廣告收入與 FCF；不得進紙上交易或正式觀察。",
    blocker: null,
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
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / shareholder letter", "revenue growth", "dollar-based net retention", "FCF margin", "large customer growth"],
  },
  {
    symbol: "REGN",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "生技品質高，但需驗證 pipeline、核心藥物成長與專利 / 集中度風險；不得進紙上交易或正式觀察。",
    blocker: null,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings release", "EYLEA / Dupixent trends", "pipeline catalysts", "patent / concentration risk"],
  },
  {
    symbol: "UNH",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "防禦型醫療龍頭，但需驗證 MLR、regulatory risk、guidance、Optum 表現；不得進紙上交易或正式觀察。",
    blocker: null,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
    nextVerification: ["官方最新 10-Q / earnings release", "medical loss ratio", "guidance change", "regulatory / DOJ / Medicare risk", "Optum growth"],
  },
  {
    symbol: "DELL",
    evidenceStatus: "PENDING",
    sourceStatus: "PENDING_OFFICIAL_EVIDENCE",
    status: "EVIDENCE_PENDING_ONLY",
    tag: "待官方驗證",
    decision: "AI server 敘事強，但需驗證 margin、backlog quality、AI server profitability 與 PC 周期；不得進紙上交易或正式觀察。",
    blocker: null,
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
    version: "v17-market-45-evidence-registry-v1",
    updatedAt: new Date().toISOString(),
    total: rows.length,
    rows,
  };
}

export function getMarket45EvidenceMap() {
  const registry = getMarket45EvidenceRegistry();
  return new Map(registry.rows.map((row) => [normalize(row.symbol), row]));
}
