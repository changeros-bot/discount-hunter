const rows = [
  ["NVDA",86.0,16.5,8.5,8.0,"QUALITY_GATE_STRONG_DRAFT_PASS_NO_PERMISSION","Verified 16+ watch-only. Strong AI compute platform, but export controls, supply-chain/inventory, customer concentration, and ASIC/TPU risk block permissions."],
  ["MSFT",84.0,16.0,8.0,8.0,"QUALITY_GATE_STRONG_DRAFT_PASS_NO_PERMISSION","Strong enterprise AI/cloud platform draft pass; AI CapEx, Azure margin, Copilot monetization, OpenAI dependency, and valuation require official verification."],
  ["AVGO",84.0,15.5,8.0,7.5,"QUALITY_GATE_DRAFT_PASS_WATCH_NO_PERMISSION","Verified high-draft watch. AI semiconductor revenue and FCF are strong, but VMware integration, debt, customer concentration, and valuation remain unresolved."],
  ["TSM",83.0,15.5,8.0,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Central AI foundry bottleneck, but geopolitical, overseas fab cost, and CapEx risks prevent permissions."],
  ["MA",83.0,15.5,8.0,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","High-quality global payment network draft pass. Cross-border volume, regulation/interchange pressure, consumer cycle, and valuation require verification."],
  ["V",82.5,15.5,8.0,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","High-quality global payment network draft pass. Payments volume, cross-border volume, regulation/litigation, competition, and valuation require verification."],
  ["GOOGL",82.0,15.5,8.0,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Ads cashflow and AI infrastructure are strong, but search AI disruption, AI CapEx, regulation, and cloud margin require verification."],
  ["META",82.0,15.5,8.5,7.0,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Draft pass, but AI CapEx and FCF durability are not fully verified."],
  ["ANET",82.5,15.0,8.0,7.0,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","High-quality AI networking beneficiary, but cloud titan concentration, Ethernet AI cycle, inventory, and margin durability require verification."],
  ["AMZN",81.0,15.0,7.5,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","AWS, retail, ads, logistics, and AI engines are strong, but AWS AI CapEx, margin, retail leverage, and FCF must be verified."],
  ["NOW",81.5,14.5,7.5,7.0,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Draft pass, but Armis acquisition, margin pressure, and growth durability need official verification."],
  ["MU",81.0,14.5,7.0,7.5,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Draft pass as HBM / AI memory infrastructure candidate. No permission until HBM ramp, pricing, margin, CapEx, and customer qualification are verified."],
  ["INTU",80.0,14.5,7.5,7.0,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","High-quality tax/accounting and SMB fintech data platform, but AI disruption, valuation, TurboTax/QuickBooks growth, SMB cycle, and margins require verification."],
  ["VRT",80.5,14.0,7.0,7.0,"QUALITY_GATE_DRAFT_PASS_NO_PERMISSION","Borderline draft pass. Direct AI data-center power/cooling beneficiary, but execution, backlog quality, working capital, and valuation must be verified."],
];

const riskMap = {
  NVDA: ["export controls", "inventory/supply-chain commitments", "customer concentration", "ASIC/TPU competition"],
  MSFT: ["AI CapEx", "Azure margin", "Copilot monetization", "OpenAI dependency", "valuation"],
  AVGO: ["VMware integration", "debt paydown", "customer concentration", "valuation vs FCF"],
  TSM: ["geopolitical risk", "overseas fab cost", "CapEx intensity", "AI customer concentration"],
  MA: ["cross-border volume", "regulation/interchange pressure", "consumer spending cycle", "valuation"],
  V: ["payments volume", "cross-border volume", "regulation/litigation", "competition", "valuation"],
  GOOGL: ["search AI disruption", "AI CapEx", "regulatory remedies", "cloud margin"],
  META: ["AI CapEx", "FCF durability", "Reality Labs losses", "regulatory/litigation risk"],
  ANET: ["cloud titan concentration", "AI Ethernet cycle", "gross margin", "inventory"],
  AMZN: ["AWS growth/margin", "AI/data-center CapEx", "retail margin", "FCF"],
  NOW: ["Armis integration", "subscription growth", "margin/FCF", "AI workflow disruption"],
  MU: ["HBM ramp", "pricing", "margin", "CapEx", "customer qualification"],
  INTU: ["TurboTax growth", "QuickBooks growth", "AI tax/accounting disruption", "SMB cycle", "valuation"],
  VRT: ["backlog conversion", "working capital", "margin", "liquid cooling demand", "valuation"],
};

function makeRow([symbol, fairScore, totalScore, objectiveScore, qualitativeScore, status, verdict]) {
  const risks = riskMap[symbol] || [];
  return {
    symbol,
    source: "Market 91 Quality Gate Queue",
    fairScore,
    status,
    confidence: "draft_quality_gate_requires_official_evidence",
    totalScore,
    maxScore: 18,
    objectiveScore,
    qualitativeScore,
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    verdict,
    objectiveChecks: [
      { name: "Revenue trend", score: Math.min(2, Math.max(1, objectiveScore / 5)), max: 2, status: "草稿", reason: "Requires latest official revenue / segment evidence." },
      { name: "Free cash flow quality", score: Math.min(2, Math.max(1, objectiveScore / 5)), max: 2, status: "草稿", reason: "Requires official cash-flow evidence after CapEx and working capital." },
      { name: "Margin quality", score: Math.min(2, Math.max(1, objectiveScore / 5)), max: 2, status: "草稿", reason: "Requires official margin trend and pressure-point evidence." },
      { name: "Balance sheet / leverage", score: Math.min(2, Math.max(1, objectiveScore / 5)), max: 2, status: "草稿", reason: "Requires balance sheet, debt, and capital allocation evidence." },
      { name: "CapEx / capital discipline", score: Math.min(2, Math.max(1, objectiveScore / 5)), max: 2, status: "草稿", reason: "Requires capital discipline evidence." },
    ],
    qualitativeChecks: [
      { name: "Industry position", score: Math.min(2, Math.max(1, qualitativeScore / 4)), max: 2, status: "草稿", reason: "Requires moat and position verification." },
      { name: "Moat / switching cost / scale", score: Math.min(2, Math.max(1, qualitativeScore / 4)), max: 2, status: "草稿", reason: "Requires switching-cost / scale evidence." },
      { name: "Management / capital allocation", score: Math.min(2, Math.max(1, qualitativeScore / 4)), max: 2, status: "草稿", reason: "Requires management and capital allocation evidence." },
      { name: "Thesis durability", score: Math.min(2, Math.max(1, qualitativeScore / 4)), max: 2, status: "草稿", reason: "Requires main thesis and failure-mode evidence." },
    ],
    hardBlockers: risks.map((x) => `If ${x} becomes a material thesis break, permission remains blocked.`),
    nextEvidence: risks.map((x) => `Verify ${x} with official filings / earnings materials`),
  };
}

const QUALITY_GATE_DRAFTS = rows.map(makeRow);

function getQualityGateDrafts() {
  return {
    version: "v17-market-91-quality-gate-drafts-v7-payments-expanded",
    policy: "draft_quality_gate_only_no_trading_permission",
    scoring: { objectiveMax: 10, qualitativeMax: 8, totalMax: 18, pass: 14, strong: 16, tradingReview: 18 },
    summary: {
      total: QUALITY_GATE_DRAFTS.length,
      draftPass: QUALITY_GATE_DRAFTS.filter((x) => x.totalScore >= 14).length,
      strongDraft: QUALITY_GATE_DRAFTS.filter((x) => x.totalScore >= 16).length,
      tradingPermission: 0,
      reviewOrder: QUALITY_GATE_DRAFTS.map((x) => x.symbol),
    },
    rows: QUALITY_GATE_DRAFTS,
  };
}

module.exports = { QUALITY_GATE_DRAFTS, getQualityGateDrafts };
