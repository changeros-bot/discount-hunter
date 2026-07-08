const MARKET_91_SOURCE_VERIFICATION = [
  {
    symbol: "NOW",
    name: "ServiceNow",
    status: "PENDING",
    decisionGate: "Source Verified 才能進正式 Quality Audit Center",
    checks: [
      "最近 4 季營收成長與訂閱收入成長",
      "自由現金流與 FCF margin",
      "毛利率與營業利益率趨勢",
      "SBC / 稀釋風險",
      "估值區間：P/S、P/FCF、forward multiple",
      "AI 工作流與平台成長是否只是敘事",
    ],
  },
  {
    symbol: "HUBB",
    name: "Hubbell",
    status: "PENDING",
    decisionGate: "Source Verified 才能進正式 Quality Audit Center",
    checks: [
      "最近 4 季營收與 organic growth",
      "訂單 / backlog / 電網需求趨勢",
      "毛利率與價格轉嫁能力",
      "自由現金流與資本支出",
      "資料中心 / 電力升級需求是否真實反映在財報",
      "估值是否已過度反映電力基建敘事",
    ],
  },
  {
    symbol: "QCOM",
    name: "Qualcomm",
    status: "PENDING",
    decisionGate: "Source Verified 才能進正式 Quality Audit Center",
    checks: [
      "手機晶片週期是否復甦",
      "授權業務營收與利潤穩定性",
      "車用 / IoT / edge AI 成長是否足以降低手機依賴",
      "自由現金流與回購品質",
      "主要客戶集中與 Apple 風險",
      "與 NVDA / AVGO / TSM 既有曝險是否重疊過高",
    ],
  },
  {
    symbol: "ORCL",
    name: "Oracle",
    status: "PENDING",
    decisionGate: "Source Verified 才能進正式 Quality Audit Center",
    checks: [
      "Oracle Cloud Infrastructure 成長率",
      "資料庫與雲端續約 / 黏著度",
      "自由現金流與負債水位",
      "AI / 資料中心 CapEx 是否壓縮 FCF",
      "毛利率與營業利益率",
      "估值是否過度反映 AI 雲端成長",
    ],
  },
  {
    symbol: "REGN",
    name: "Regeneron",
    status: "PENDING",
    decisionGate: "Source Verified 才能進正式 Quality Audit Center",
    checks: [
      "核心產品營收集中度",
      "pipeline 與臨床試驗進展",
      "專利到期與競爭藥物風險",
      "自由現金流與研發支出品質",
      "監管 / 藥價風險",
      "是否能作為非科技分散，而不是單純防禦股",
    ],
  },
];

function getMarket91SourceVerification() {
  return {
    version: "v17-market-91-source-verification-v1",
    source: "market_91_formal_observation_candidates",
    policy: "verification_tracker_only_no_buy_no_dca_no_semi_auto",
    summary: {
      total: MARKET_91_SOURCE_VERIFICATION.length,
      pending: MARKET_91_SOURCE_VERIFICATION.filter((x) => x.status === "PENDING").length,
      verified: MARKET_91_SOURCE_VERIFICATION.filter((x) => x.status === "VERIFIED").length,
    },
    rows: MARKET_91_SOURCE_VERIFICATION,
  };
}

module.exports = { MARKET_91_SOURCE_VERIFICATION, getMarket91SourceVerification };
