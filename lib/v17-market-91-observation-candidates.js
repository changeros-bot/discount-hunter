const MARKET_91_OBSERVATION_CANDIDATES = [
  {
    symbol: "NOW",
    name: "ServiceNow",
    bucket: "企業軟體",
    decision: "FORMAL_OBSERVATION_CANDIDATE",
    priority: 1,
    reason: "Quality 草稿 17/18，企業軟體與 AI 工作流敘事清楚，回測強，與現有持倉重疊低。",
    role: "Software Quality Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；折價訊號只提醒不下單。",
    nextStep: "來源驗證：營收成長、FCF、毛利率、估值區間、SBC。",
  },
  {
    symbol: "HUBB",
    name: "Hubbell",
    bucket: "電力 / 工業基礎建設",
    decision: "FORMAL_OBSERVATION_CANDIDATE",
    priority: 2,
    reason: "Quality 草稿 16/18，代表非科技但與 AI 電力基建相關的現實世界受益者。",
    role: "Infrastructure Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；跌深需搭配產業需求驗證。",
    nextStep: "來源驗證：訂單、營收、毛利率、電網/資料中心需求、估值。",
  },
  {
    symbol: "QCOM",
    name: "Qualcomm",
    bucket: "半導體 / 邊緣 AI",
    decision: "FORMAL_OBSERVATION_CANDIDATE",
    priority: 3,
    reason: "Quality 草稿 16/18，半導體補強但與 NVDA、AVGO 不完全重疊。",
    role: "Semiconductor Satellite Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；避免半導體過度集中。",
    nextStep: "來源驗證：手機週期、車用/IoT、授權業務、FCF、客戶集中。",
  },
  {
    symbol: "ORCL",
    name: "Oracle",
    bucket: "雲端 / 資料庫",
    decision: "FORMAL_OBSERVATION_CANDIDATE",
    priority: 4,
    reason: "Quality 草稿 15/18，資料庫與雲端基礎設施敘事清楚。",
    role: "Cloud Infrastructure Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；負債與 CapEx 必須驗證。",
    nextStep: "來源驗證：雲端成長、資料庫黏著度、FCF、負債、AI CapEx。",
  },
  {
    symbol: "REGN",
    name: "Regeneron",
    bucket: "醫療 / 生技品質",
    decision: "FORMAL_OBSERVATION_CANDIDATE",
    priority: 5,
    reason: "Quality 草稿 14/18，作為非科技分散候選，但產品線與專利風險要嚴審。",
    role: "Healthcare Quality Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；需醫療產品線審查。",
    nextStep: "來源驗證：核心產品、pipeline、專利風險、FCF、監管風險。",
  },
];

const MARKET_91_RESERVE_CANDIDATES = [
  { symbol: "META", reason: "Quality 草稿很強，但與 GOOGL / QQQ 平台曝險重疊，先保留。" },
  { symbol: "NET", reason: "Quality 草稿 14/18，但估值與波動高，只保留。" },
  { symbol: "DELL", reason: "AI 伺服器鏈有價值，但硬體毛利與週期風險較高。" },
  { symbol: "UNH", reason: "醫療防禦候選，但政策與營運風險目前偏高。" },
  { symbol: "EQT", reason: "能源天然氣候選，但週期性太強，暫不列正式觀察。" },
];

function getMarket91ObservationCandidates() {
  return {
    version: "v17-market-91-observation-candidates-v1",
    source: "market_91_quality_draft_deep_review",
    policy: "formal_observation_only_not_buying_list_not_semi_auto_not_auto_whitelist",
    summary: {
      selected: MARKET_91_OBSERVATION_CANDIDATES.length,
      reserve: MARKET_91_RESERVE_CANDIDATES.length,
    },
    rows: MARKET_91_OBSERVATION_CANDIDATES,
    reserve: MARKET_91_RESERVE_CANDIDATES,
  };
}

module.exports = { MARKET_91_OBSERVATION_CANDIDATES, MARKET_91_RESERVE_CANDIDATES, getMarket91ObservationCandidates };
