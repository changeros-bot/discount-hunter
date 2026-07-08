const MARKET_91_SHORTLIST = [
  { symbol: "QCOM", name: "Qualcomm", bucket: "科技 / 半導體", tier: "DEEP_REVIEW", reason: "半導體補強，與 NVDA / AVGO 不完全重疊。", proposedRole: "Satellite Candidate", proposedRule: "固定DCA禁止；只做折價候選，需 Quality Gate。" },
  { symbol: "ORCL", name: "Oracle", bucket: "雲端 / 資料庫", tier: "DEEP_REVIEW", reason: "雲端與資料庫基礎設施，回測強。", proposedRole: "Cloud Infrastructure Candidate", proposedRule: "固定DCA禁止；折價候選。" },
  { symbol: "DELL", name: "Dell", bucket: "AI 伺服器鏈", tier: "DEEP_REVIEW", reason: "AI 伺服器供應鏈補位，但需檢查毛利與景氣循環。", proposedRole: "AI Hardware Candidate", proposedRule: "只做折價，不做固定DCA。" },
  { symbol: "NOW", name: "ServiceNow", bucket: "企業軟體", tier: "DEEP_REVIEW", reason: "企業軟體與 AI 工作流，Quality Gate 好審。", proposedRole: "Software Candidate", proposedRule: "折價候選；估值需嚴審。" },
  { symbol: "NET", name: "Cloudflare", bucket: "雲端網路 / 安全", tier: "DEEP_REVIEW", reason: "雲端網路與安全基礎設施，但波動較高。", proposedRole: "Cloud Network Candidate", proposedRule: "只做深折價；不得固定DCA。" },
  { symbol: "META", name: "Meta", bucket: "大型平台 / AI", tier: "DEEP_REVIEW", reason: "大型平台 + AI 資本開支，補 GOOGL 之外的平台曝險。", proposedRole: "Platform Candidate", proposedRule: "折價候選；需避免與 GOOGL 過度重疊。" },
  { symbol: "HUBB", name: "Hubbell", bucket: "電力 / 工業基礎建設", tier: "DEEP_REVIEW", reason: "電力基礎建設受益者，符合非科技主線。", proposedRole: "Infrastructure Candidate", proposedRule: "折價候選；可作 AI 電力鏈補充。" },
  { symbol: "REGN", name: "Regeneron", bucket: "醫療 / 生技品質", tier: "DEEP_REVIEW", reason: "醫療品質股，作為非科技分散。", proposedRole: "Healthcare Quality Candidate", proposedRule: "折價候選；需嚴審產品線與專利風險。" },
  { symbol: "UNH", name: "UnitedHealth", bucket: "醫療 / 防禦成長", tier: "DEEP_REVIEW", reason: "醫療保險龍頭，防禦型成長，但政策風險需審。", proposedRole: "Healthcare Defensive Candidate", proposedRule: "折價候選；需政策風險標籤。" },
  { symbol: "EQT", name: "EQT", bucket: "能源 / 天然氣", tier: "DEEP_REVIEW", reason: "能源天然氣代表，開放非科技週期配置。", proposedRole: "Cycle Candidate", proposedRule: "不固定DCA；只深折價；低權重。" },

  { symbol: "SMCI", name: "Super Micro Computer", bucket: "AI 伺服器鏈", tier: "SECOND_REVIEW", reason: "回測可研究，但波動與公司治理/會計風險需嚴審。", proposedRole: "High Volatility AI Candidate", proposedRule: "只深折價；不可自動化。" },
  { symbol: "UNP", name: "Union Pacific", bucket: "工業 / 運輸基礎建設", tier: "SECOND_REVIEW", reason: "鐵路基礎設施代表，非科技分散。", proposedRole: "Infrastructure Candidate", proposedRule: "折價候選；需景氣敏感標籤。" },
  { symbol: "STLD", name: "Steel Dynamics", bucket: "工業 / 鋼鐵", tier: "SECOND_REVIEW", reason: "回測強，但週期性高。", proposedRole: "Cyclical Industry Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "NUE", name: "Nucor", bucket: "工業 / 鋼鐵", tier: "SECOND_REVIEW", reason: "鋼鐵龍頭，需與 STLD 二選一。", proposedRole: "Cyclical Industry Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "EQIX", name: "Equinix", bucket: "數據中心 / REIT", tier: "SECOND_REVIEW", reason: "數據中心基礎設施，但 REIT 與利率敏感。", proposedRole: "Data Center REIT Candidate", proposedRule: "折價候選；利率風險標籤。" },
  { symbol: "HII", name: "Huntington Ingalls", bucket: "國防 / 造艦", tier: "SECOND_REVIEW", reason: "國防工業長週期，但流動性與產業特性需審。", proposedRole: "Defense Candidate", proposedRule: "折價候選；非核心。" },
  { symbol: "LMT", name: "Lockheed Martin", bucket: "國防 / 航太", tier: "SECOND_REVIEW", reason: "國防龍頭，防禦型非科技候選。", proposedRole: "Defense Candidate", proposedRule: "折價候選；低頻。" },
  { symbol: "MRK", name: "Merck", bucket: "醫療 / 製藥", tier: "SECOND_REVIEW", reason: "製藥品質股，但專利週期需審。", proposedRole: "Healthcare Candidate", proposedRule: "折價候選；需產品線審查。" },
  { symbol: "PFE", name: "Pfizer", bucket: "醫療 / 製藥", tier: "SECOND_REVIEW", reason: "回測強，但基本面與成長性需嚴格二審。", proposedRole: "Healthcare Candidate", proposedRule: "不得直接加入；Quality Gate 不過即排除。" },
  { symbol: "COP", name: "ConocoPhillips", bucket: "能源 / 油氣", tier: "SECOND_REVIEW", reason: "能源強候選，但油價週期風險高。", proposedRole: "Cycle Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "CVX", name: "Chevron", bucket: "能源 / 油氣龍頭", tier: "SECOND_REVIEW", reason: "大型能源龍頭，防守性較高。", proposedRole: "Energy Major Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "ENB", name: "Enbridge", bucket: "能源 / 管線", tier: "SECOND_REVIEW", reason: "管線現金流型能源標的，需稅務與股息因素審。", proposedRole: "Energy Infrastructure Candidate", proposedRule: "折價候選；低權重。" },
  { symbol: "SLB", name: "Schlumberger", bucket: "能源服務", tier: "SECOND_REVIEW", reason: "油服週期較強，需嚴格限制。", proposedRole: "Energy Services Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "OXY", name: "Occidental Petroleum", bucket: "能源 / 油氣", tier: "SECOND_REVIEW", reason: "能源週期候選，波動需控。", proposedRole: "Cycle Candidate", proposedRule: "只深折價；低權重。" },
  { symbol: "VDE", name: "Vanguard Energy ETF", bucket: "能源 ETF", tier: "SECOND_REVIEW", reason: "能源類 ETF，若不想選個股可作替代。", proposedRole: "Energy ETF Candidate", proposedRule: "只深折價；低權重。" },
];

function getMarket91Shortlist() {
  const deep = MARKET_91_SHORTLIST.filter((x) => x.tier === "DEEP_REVIEW");
  const second = MARKET_91_SHORTLIST.filter((x) => x.tier === "SECOND_REVIEW");
  const buckets = MARKET_91_SHORTLIST.reduce((acc, item) => {
    acc[item.bucket] = (acc[item.bucket] || 0) + 1;
    return acc;
  }, {});
  return {
    version: "v17-market-91-shortlist-v1",
    source: "market_91_discount_hunter_backtest",
    policy: "research_only_not_added_to_official_watchlist",
    summary: {
      total: MARKET_91_SHORTLIST.length,
      deepReview: deep.length,
      secondReview: second.length,
      buckets,
    },
    rows: MARKET_91_SHORTLIST,
  };
}

module.exports = { MARKET_91_SHORTLIST, getMarket91Shortlist };
