const QUALITY_GATE_DRAFTS = [
  {
    symbol: "META",
    source: "Market 91 Quality Gate Queue",
    fairScore: 82.0,
    status: "QUALITY_GATE_DRAFT_PASS_NO_PERMISSION",
    confidence: "q1_2026_public_sources_checked_official_10q_still_required",
    totalScore: 15.5,
    maxScore: 18,
    objectiveScore: 8.5,
    qualitativeScore: 7.0,
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    verdict: "Draft pass into deeper monitoring, but not enough for trading permission because AI CapEx and FCF durability are not fully verified.",
    objectiveChecks: [
      { name: "Revenue trend", score: 2, max: 2, status: "通過", reason: "Q1 2026 revenue growth appears very strong; advertising engine remains intact." },
      { name: "Free cash flow quality", score: 1.5, max: 2, status: "觀察", reason: "Core cash generation is strong, but 2026 AI CapEx plan may pressure FCF." },
      { name: "Margin quality", score: 2, max: 2, status: "通過", reason: "Scale economics and advertising margin remain high." },
      { name: "Balance sheet / leverage", score: 2, max: 2, status: "通過", reason: "Large cash generation and balance sheet flexibility; no near-term funding stress identified." },
      { name: "CapEx / capital discipline", score: 1, max: 2, status: "觀察", reason: "Raised 2026 CapEx guide and AI data center spending create overbuild / return-on-capital risk." },
    ],
    qualitativeChecks: [
      { name: "Industry position", score: 2, max: 2, status: "通過", reason: "Global social graph, ads scale, Instagram / WhatsApp distribution, and AI user reach remain top tier." },
      { name: "Moat / switching cost / scale", score: 2, max: 2, status: "通過", reason: "Network effects, ad data, and distribution scale are extremely difficult to replicate." },
      { name: "Management / capital allocation", score: 1.5, max: 2, status: "觀察", reason: "Execution ability is strong, but AI infrastructure spending discipline is the core variable." },
      { name: "Thesis durability", score: 1.5, max: 2, status: "觀察", reason: "AI monetization must offset CapEx intensity; regulatory and social-platform risks remain." },
    ],
    hardBlockers: [
      "If FCF turns structurally negative because of AI CapEx, Quality Gate fails.",
      "If AI compute overbuild becomes visible without monetization, score must be cut.",
      "If regulatory or child-safety litigation materially impairs ad business, thesis must be reset.",
    ],
    nextEvidence: [
      "Latest official 10-Q cash-flow statement",
      "2026 CapEx guide and management commentary",
      "FCF after AI infrastructure spend",
      "Reality Labs loss and AI monetization evidence",
      "Regulatory / litigation update",
    ],
  },
  {
    symbol: "NOW",
    source: "Market 91 Quality Gate Queue",
    fairScore: 81.5,
    status: "QUALITY_GATE_DRAFT_PASS_NO_PERMISSION",
    confidence: "q1_2026_public_sources_checked_official_10q_and_armis_integration_required",
    totalScore: 14.5,
    maxScore: 18,
    objectiveScore: 7.5,
    qualitativeScore: 7.0,
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    verdict: "Draft pass, but weaker than META because Armis acquisition, margin pressure, and growth durability need official verification.",
    objectiveChecks: [
      { name: "Revenue trend", score: 2, max: 2, status: "通過", reason: "Subscription revenue growth remains strong enough for Quality Gate draft pass." },
      { name: "Free cash flow quality", score: 1.5, max: 2, status: "觀察", reason: "ServiceNow historically has strong FCF, but Armis and growth investments must be verified after Q1." },
      { name: "Margin quality", score: 1, max: 2, status: "觀察", reason: "Armis acquisition and AI/product investments may compress margin in the near term." },
      { name: "Balance sheet / leverage", score: 1.5, max: 2, status: "觀察", reason: "Large acquisition requires verification of cash/debt impact and capital allocation discipline." },
      { name: "CapEx / capital discipline", score: 1.5, max: 2, status: "觀察", reason: "Less CapEx-heavy than hyperscalers, but acquisition discipline is the key capital allocation test." },
    ],
    qualitativeChecks: [
      { name: "Industry position", score: 2, max: 2, status: "通過", reason: "ServiceNow remains a leader in workflow automation / enterprise service management." },
      { name: "Moat / switching cost / scale", score: 2, max: 2, status: "通過", reason: "Enterprise workflow integration creates switching cost and process lock-in." },
      { name: "Management / capital allocation", score: 1.5, max: 2, status: "觀察", reason: "Armis integration is the major capital allocation test." },
      { name: "Thesis durability", score: 1.5, max: 2, status: "觀察", reason: "AI can expand platform value, but AI-native workflow disruption risk must be watched." },
    ],
    hardBlockers: [
      "If Armis integration damages FCF or margins more than expected, Quality Gate fails.",
      "If CRPO / subscription growth decelerates below durable compounder level, score must be cut.",
      "If AI-native tools erode workflow platform pricing power, thesis must be reset.",
    ],
    nextEvidence: [
      "Latest official 10-Q and earnings presentation",
      "Subscription revenue and CRPO trend",
      "Operating margin / FCF after Armis acquisition",
      "Balance sheet impact of acquisition",
      "AI product monetization and retention evidence",
    ],
  },
];

function getQualityGateDrafts() {
  return {
    version: "v17-market-91-quality-gate-drafts-v1-meta-now",
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
