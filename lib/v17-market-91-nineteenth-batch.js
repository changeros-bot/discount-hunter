const NINETEENTH_BATCH = [
  {
    symbol: "KO",
    score: 73.0,
    status: "RESERVE_SECOND_REVIEW_CONSUMER_STAPLES_LOW_GROWTH_VALUATION",
    confidence: "global_beverage_brand_quality_high_but_growth_rate_volume_fx_and_valuation_need_verification",
    tag: "飲料品牌防禦二審",
    blocker: "Organic volume growth, pricing vs elasticity, FX, concentrate margin durability, bottler economics, sugar/health regulation, and valuation block formal observation",
    note: "Coca-Cola 是全球飲料品牌與通路護城河很強的消費必需品公司，但低成長、volume 彈性、匯率、健康/糖稅監管與估值使它只能列為二審防禦股，不進正式觀察候選。",
    bucket: "Consumer staples / beverage brand / global distribution / defensive compounder",
    permissions: { buy: false, dca: false, semiAuto: false, whitelist: false },
    nextVerification: ["latest official results", "organic sales", "volume vs price", "concentrate margin", "bottler economics", "FX impact", "FCF", "dividend coverage", "valuation"],
  },
];

function getNineteenthBatch() {
  return {
    version: "v17-market-91-nineteenth-batch-v1-final-ko-closeout",
    policy: "draft_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    batch: "KO_FINAL_CLOSEOUT",
    closeout: true,
    summary: {
      total: NINETEENTH_BATCH.length,
      observationOnly: NINETEENTH_BATCH.filter((x) => x.status.includes("FORMAL_OBSERVATION")).length,
      reserve: NINETEENTH_BATCH.filter((x) => x.status.includes("RESERVE")).length,
      researchOnly: NINETEENTH_BATCH.filter((x) => x.status.includes("RESEARCH_POOL")).length,
      blocked: NINETEENTH_BATCH.filter((x) => x.status.includes("BLOCKED")).length,
    },
    rows: NINETEENTH_BATCH,
  };
}

module.exports = { NINETEENTH_BATCH, getNineteenthBatch };
