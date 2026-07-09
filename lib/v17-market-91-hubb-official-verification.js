const HUBB_OFFICIAL_VERIFICATION = {
  version: "v17-market-91-hubb-official-verification-v1",
  symbol: "HUBB",
  sourceStatus: "official_q1_2026_verified_nsi_followup_required",
  previousScore: 79.0,
  verifiedScore: 79.0,
  status: "OFFICIAL_Q1_VERIFIED_RESERVE_PENDING_NSI_INTEGRATION",
  confidence: "official_q1_verified_but_post_quarter_acquisition_debt_risk",
  tag: "官方Q1已驗證 / 仍未升80",
  blocker: "NSI 併購與債務融資後的槓桿、整合、利息費用尚未反映在完整季度財報",
  decision: "維持 79.0，不升正式觀察候選。Q1 經營品質支持高分，但 NSI 交易與 $1.9B senior notes 讓 D 風險適配扣分不能取消。",
  officialEvidence: [
    { item: "Q1 adjusted EPS", value: "$3.93, up 16% y/y", impact: "+", note: "盈利動能強，支持 B 財務層。" },
    { item: "Q1 net sales", value: "+11%, organic +8.2%", impact: "+", note: "需求不是單純併購堆出來，organic 仍強。" },
    { item: "Q1 adjusted operating margin", value: "19.8%, up 110 bps y/y", impact: "+", note: "毛利/營運效率並未被成長稀釋。" },
    { item: "Q1 free cash flow", value: "$46M vs $11M prior year", impact: "+", note: "FCF 有改善，但單季仍不能覆蓋大型併購。" },
    { item: "FY2026 outlook", value: "sales +8% to +11%, organic +6% to +9%, FCF conversion >=90%", impact: "+", note: "管理層上修展望，支持成長假設。" },
    { item: "NSI acquisition", value: "$3.0B cash transaction, financed with cash and debt", impact: "-", note: "提高財務槓桿與整合風險。" },
    { item: "Senior notes", value: "$1.9B notes priced in June 2026", impact: "-", note: "債務結構清楚，但利息費用與整合後資產負債表需後續驗證。" },
  ],
  scoreRationale: {
    keepHigh: [
      "Q1 2026 organic growth and margin expansion are strong enough to reject a downgrade into normal second-review range.",
      "Utility grid / transmission / substation and data center / light industrial demand fit the infrastructure thesis.",
      "FCF improved year over year and full-year FCF conversion guide remains strong.",
    ],
    doNotUpgrade: [
      "Large NSI transaction changes balance-sheet risk after Q1 quarter end.",
      "Debt-funded acquisition raises interest, integration, and capital allocation risk.",
      "Score is close to 80, but 100-point governance requires objective layer to win over narrative excitement.",
    ],
  },
  permissions: {
    buy: false,
    dca: false,
    semiAuto: false,
    whitelist: false,
    formalObservationCandidate: false,
  },
  nextVerification: [
    "Verify Q2 2026 results after NSI closing impact begins to show.",
    "Track post-NSI net debt / EBITDA or management leverage commentary.",
    "Check whether HES margin actually becomes accretive after NSI integration.",
    "Review interest expense impact after $1.9B senior notes issuance.",
    "Only reconsider 80+ if growth, margin, and leverage discipline all remain intact.",
  ],
};

function getHubbOfficialVerification() {
  return HUBB_OFFICIAL_VERIFICATION;
}

module.exports = { HUBB_OFFICIAL_VERIFICATION, getHubbOfficialVerification };
