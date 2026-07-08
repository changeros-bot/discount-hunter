const MARKET_91_OBSERVATION_CANDIDATES = [
  {
    symbol: "NOW",
    name: "ServiceNow",
    bucket: "企業軟體",
    decision: "FORMAL_OBSERVATION_CANDIDATE_PENDING_18_POINT_VERIFICATION",
    priority: 1,
    reason: "企業軟體與 AI 工作流敘事清楚，回測強；但必須補完同一套 18 分 Quality Gate 來源驗證後才可升級。",
    role: "Software Quality Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；折價訊號只提醒不下單；不得半自動。",
    nextStep: "補跑正式 18 分表：營收成長、FCF、毛利率、資產負債表、CapEx/SBC、護城河、管理層、投資假設。",
  },
  {
    symbol: "QCOM",
    name: "Qualcomm",
    bucket: "半導體 / 邊緣 AI",
    decision: "FORMAL_OBSERVATION_CANDIDATE_PENDING_18_POINT_VERIFICATION",
    priority: 2,
    reason: "半導體補強且與 NVDA、AVGO 不完全重疊；但手機週期與既有半導體曝險必須進 18 分表扣分。",
    role: "Semiconductor Satellite Candidate",
    rule: "只進正式觀察候選；固定 DCA 禁止；避免半導體過度集中；不得半自動。",
    nextStep: "補跑正式 18 分表：手機週期、授權業務、車用/IoT/Edge AI、FCF、客戶集中、曝險重疊。",
  },
];

const MARKET_91_PENDING_CANDIDATES = [
  {
    symbol: "HUBB",
    reason: "電力基建敘事可研究，但目前只完成部分驗證；沒有最近官方季報數字前，不可列正式觀察。",
    requiredFix: "補最近一份季報、organic growth、orders/backlog、FCF、margin、估值。",
  },
  {
    symbol: "REGN",
    reason: "生技/製藥屬新資產桶；現有通用 18 分表不足以處理專利懸崖、FDA/臨床、pipeline 風險。",
    requiredFix: "先建立 Biotech/Pharma 專用檢查表；未完成前只留 Research，不進正式觀察。",
  },
];

const MARKET_91_RESERVE_CANDIDATES = [
  { symbol: "ORCL", reason: "敘事很強，但 Objective 財務層出現 CapEx、負 FCF、融資/負債風險；Quality Gate 客觀層優先，降為保留觀察。" },
  { symbol: "META", reason: "Quality 草稿很強，但與 GOOGL / QQQ 平台曝險重疊，先保留。" },
  { symbol: "NET", reason: "Quality 草稿 14/18，但估值與波動高，只保留。" },
  { symbol: "DELL", reason: "AI 伺服器鏈有價值，但硬體毛利與週期風險較高。" },
  { symbol: "UNH", reason: "醫療防禦候選，但政策與營運風險目前偏高。" },
  { symbol: "EQT", reason: "能源天然氣候選，但週期性太強，暫不列正式觀察。" },
];

function getMarket91ObservationCandidates() {
  return {
    version: "v17-market-91-observation-candidates-v2-governance-corrected",
    source: "market_91_quality_draft_deep_review",
    policy: "observation_only_same_18_point_quality_gate_required_no_buy_no_dca_no_semi_auto",
    governance: {
      sourceUniverseLogic: "market_91 只是使用者截圖整理出的可交易/可查詢市場清單，不是選股排行榜，也不是推薦來源。",
      narrativeRule: "任何敘事型星等或 AI 推薦都只能作為初篩，必須先通過 Objective 財務層與 18 分 Quality Gate。",
      objectiveLayerPriority: "若敘事與 FCF/資產負債表/CapEx 衝突，Objective 財務層優先。",
    },
    summary: {
      selected: MARKET_91_OBSERVATION_CANDIDATES.length,
      pending: MARKET_91_PENDING_CANDIDATES.length,
      reserve: MARKET_91_RESERVE_CANDIDATES.length,
    },
    rows: MARKET_91_OBSERVATION_CANDIDATES,
    pending: MARKET_91_PENDING_CANDIDATES,
    reserve: MARKET_91_RESERVE_CANDIDATES,
  };
}

module.exports = { MARKET_91_OBSERVATION_CANDIDATES, MARKET_91_PENDING_CANDIDATES, MARKET_91_RESERVE_CANDIDATES, getMarket91ObservationCandidates };
