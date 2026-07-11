export const MARKET10_VERIFICATION = [
  {
    symbol: "MSFT",
    name: "Microsoft",
    bucket: "Mega-cap AI / Cloud",
    score: 84,
    quality: "MARKET10_VERIFIED",
    decision: "Microsoft 品質與雲端 / AI 平台地位通過；AI capex、Azure 增速、Xbox 重組與估值為追蹤風險，不構成硬性 Blocker；允許 5U、7 天紙上交易。",
    risk: "AI infrastructure capex, Azure growth durability, free cash flow pressure, gaming restructuring, antitrust/regulation and valuation must be tracked.",
    evidenceState: "VERIFIED",
    hasBlocker: false,
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
  },
  {
    symbol: "NFLX",
    name: "Netflix",
    bucket: "Streaming / Media Platform",
    score: 78,
    quality: "MARKET10_VERIFIED_WITH_GROWTH_RISK",
    decision: "Netflix 盈利能力與平台地位通過；但 viewer engagement、內容成本、廣告 tier 變現、價格彈性與競爭需追蹤，不構成硬性 Blocker；允許 5U、7 天紙上交易。",
    risk: "Viewer engagement, content spend, ad-tier monetization, price elasticity, competition with YouTube/Disney/Max and growth guidance must be tracked.",
    evidenceState: "VERIFIED",
    hasBlocker: false,
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
  },
  {
    symbol: "ADBE",
    name: "Adobe",
    bucket: "Creative Software / AI Disruption",
    score: 76,
    quality: "MARKET10_VERIFIED_WITH_AI_DISRUPTION_RISK",
    decision: "Adobe 現金流、Creative Cloud / Acrobat 基礎通過；但生成式 AI 競爭、Firefly 變現、成長放緩與管理層變動需追蹤，不構成硬性 Blocker；允許 5U、7 天紙上交易。",
    risk: "AI disruption, Firefly monetization, Creative Cloud pricing power, enterprise adoption, growth deceleration and leadership transition must be tracked.",
    evidenceState: "VERIFIED",
    hasBlocker: false,
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
  },
  {
    symbol: "SOFI",
    name: "SoFi Technologies",
    bucket: "High-risk Fintech / Credit Cycle",
    score: 68,
    quality: "MARKET10_HIGH_RISK_PAPER_ONLY",
    decision: "SoFi 成長與會員數據通過，但不是優質股等級；信用週期、貸款需求、利率、資產品質與 fintech 估值波動高；允許高風險 3U、7 天紙上壓力測試，不得視為核心候選。",
    risk: "Credit cycle, loan origination quality, deposit beta, funding cost, charge-offs, regulatory risk, crypto/stablecoin expansion and valuation volatility must be tracked.",
    evidenceState: "VERIFIED_HIGH_RISK",
    hasBlocker: false,
    paperAmountUSDT: 3,
    permissions: { paperTrading: true, formalObservation: false, realAutoTrade: false },
  },
  {
    symbol: "CRWV",
    name: "CoreWeave",
    bucket: "AI Cloud / GPU Infra",
    score: 45,
    quality: "MARKET10_RISK_BLOCK",
    decision: "CoreWeave 題材強但硬性 Blocker 成立：capex 爆炸、巨額債務、虧損擴大、客戶集中與 backlog 交付風險；不進紙上交易。",
    blocker: "Extreme capex, heavy debt, widening losses, high customer concentration, financing risk and backlog execution risk are hard blockers.",
    risk: "Capex $30B+ range, debt / interest burden, customer concentration, Nvidia / hyperscaler dependence and profitability risk must be resolved before re-entry.",
    evidenceState: "RISK_BLOCK",
    hasBlocker: true,
    permissions: { paperTrading: false, formalObservation: false, realAutoTrade: false },
  },
];

export function getMarket10Verification() {
  return {
    version: "v17-market10-verification-v1",
    updatedAt: new Date().toISOString(),
    total: MARKET10_VERIFICATION.length,
    paperEligible: MARKET10_VERIFICATION.filter((row) => row.permissions?.paperTrading && !row.hasBlocker).length,
    blocked: MARKET10_VERIFICATION.filter((row) => row.hasBlocker).length,
    rows: MARKET10_VERIFICATION,
  };
}

export function getMarket10PaperCandidates() {
  return MARKET10_VERIFICATION
    .filter((row) => row.permissions?.paperTrading && !row.hasBlocker)
    .map((row) => ({
      ...row,
      paperGroup: "Market10折價候選紙上測試",
      paperSource: "market10_discount_verified",
      canEnterPaperTrading: true,
      canEnterRealAutoTrade: false,
      finalDecision: row.decision,
    }));
}
