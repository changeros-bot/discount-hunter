const NVDA_EVIDENCE_GAP_DIAGNOSIS = {
  symbol: "NVDA",
  version: "v17-market-91-nvda-evidence-gap-diagnosis-v1",
  purpose: "Diagnose why NVDA is ready for score-lock review but not final-score locked.",
  conclusion: "The issue is mixed: core financial evidence exists in official IR data, but several rubric fields require risk assessment because official filings/releases usually do not provide direct numeric answers at the required granularity.",
  categories: {
    directlyDisclosedOfficialNumbers: [
      { field: "Revenue growth", status: "PASS_DIRECT", evidence: "Q1 FY2027 revenue $81.6B, +85% YoY, +20% QoQ" },
      { field: "Data Center growth", status: "PASS_DIRECT", evidence: "Data Center revenue $75.2B, +92% YoY, +21% QoQ" },
      { field: "Gross margin", status: "PASS_DIRECT", evidence: "GAAP gross margin 74.9%; non-GAAP gross margin 75.0%" },
      { field: "Operating income", status: "PASS_DIRECT", evidence: "GAAP operating income $53.536B" },
      { field: "Net income", status: "PASS_DIRECT", evidence: "GAAP net income $58.321B" },
      { field: "Operating cash flow", status: "PASS_DIRECT", evidence: "Net cash provided by operating activities $50.344B" },
      { field: "Balance sheet debt", status: "PASS_DIRECT", evidence: "Short-term debt $1.0B and long-term debt $7.47B" }
    ],
    calculableFromOfficialTables: [
      { field: "Approx free cash flow", status: "PASS_CALCULABLE", evidence: "OCF $50.344B minus purchases related to property/equipment/intangibles $1.757B and principal payments $0.033B = approx $48.554B" },
      { field: "Data Center concentration", status: "PASS_CALCULABLE_BUT_RISK", evidence: "Data Center revenue $75.2B / total revenue $81.615B ≈ 92.1%; this supports AI concentration strength but also concentration risk" },
      { field: "Liquidity cushion", status: "PASS_CALCULABLE", evidence: "Cash/equivalents plus marketable debt securities can be estimated from balance sheet, but investment securities include volatility and classification details" }
    ],
    structurallyNotDirectlyDisclosedAtRubricGranularity: [
      { field: "Customer concentration by hyperscaler", status: "RUBRIC_REQUIRES_RISK_JUDGMENT", issue: "Official release gives new reporting framework and customer categories but does not directly disclose exact revenue share by Microsoft/Amazon/Google/Meta or other hyperscalers." },
      { field: "Supply-chain commitments and purchase obligations by product generation", status: "RUBRIC_REQUIRES_RISK_JUDGMENT", issue: "Official release gives inventory and working-capital movement but not full forward purchase commitments by Blackwell/Rubin/customer." },
      { field: "Export controls impact beyond China compute assumption", status: "RUBRIC_REQUIRES_RISK_JUDGMENT", issue: "Official outlook states no Data Center compute revenue from China in Q2 FY2027 outlook, but does not fully quantify long-run China opportunity loss, license risk, or substitution risk." },
      { field: "ASIC/TPU/custom silicon competitive displacement", status: "RUBRIC_REQUIRES_RISK_JUDGMENT", issue: "Official company releases will not objectively quantify competitor custom silicon displacement risk; this should be handled as thesis durability risk, not as required numeric evidence." },
      { field: "Backlog / order book / supply constraint duration", status: "RUBRIC_REQUIRES_RISK_JUDGMENT", issue: "NVIDIA typically provides demand commentary and outlook rather than a formal audited backlog figure for AI accelerators." }
    ],
  },
  rubricAdjustmentRecommendation: {
    keepStrict: ["Official evidence required", "No media-only score lock", "No automatic permission from strong financials"],
    adjustRubric: [
      "Separate official numeric evidence from official risk disclosure and management commentary.",
      "Do not require exact customer-level revenue share if the company does not disclose it; instead mark concentration risk as qualitative blocker requiring official clues plus conservative judgment.",
      "Treat ASIC/TPU competition as thesis durability risk, not a numeric evidence field.",
      "Treat export controls as open risk unless official filing/release quantifies current-period impact and outlook assumptions."
    ],
    scoreLockImplication: "NVDA can proceed to score-lock review, but final score should include open qualitative blockers rather than waiting for impossible-to-disclose exact numbers.",
  },
  permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
};

function getNvdaEvidenceGapDiagnosis() {
  return NVDA_EVIDENCE_GAP_DIAGNOSIS;
}

module.exports = { NVDA_EVIDENCE_GAP_DIAGNOSIS, getNvdaEvidenceGapDiagnosis };
