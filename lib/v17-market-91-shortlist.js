const CONFIRMED_MARKET_91_MAIN_LIST = [
  { symbol: "NVDA", name: "NVIDIA", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "AI GPU / CUDA 生態核心。", proposedRole: "AI Infrastructure Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "AVGO", name: "Broadcom", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "AI ASIC、網通、基礎設施核心。", proposedRole: "AI Infrastructure Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "TSM", name: "Taiwan Semiconductor", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "先進製程與 AI 晶片供應鏈核心。", proposedRole: "AI Foundry Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "MSFT", name: "Microsoft", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "Azure、Copilot、企業 AI 平台。", proposedRole: "Platform Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "META", name: "Meta", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "社群平台現金流 + AI 推薦/廣告/模型基礎設施。", proposedRole: "Platform Core", proposedRule: "不追高；需避免與 GOOGL 過度重疊。" },
  { symbol: "GOOGL", name: "Alphabet", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "搜尋、YouTube、雲端與 AI 模型平台。", proposedRole: "Platform Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "AMZN", name: "Amazon", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "AWS、電商現金流與 AI 雲端需求。", proposedRole: "Cloud Platform Core", proposedRule: "不追高；只在折價觸發後加碼。" },
  { symbol: "MU", name: "Micron", bucket: "AI Core / Satellite", tier: "CONFIRMED_MAIN", reason: "HBM / AI 記憶體基礎設施；不再用傳統景氣循環股標籤處理。", proposedRole: "AI Memory Infrastructure", proposedRule: "波動高；只在折價觸發後小額加碼。" },

  { symbol: "QCOM", name: "Qualcomm", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "邊緣 AI、車用與連線晶片補強，與 NVDA / AVGO 不完全重疊。", proposedRole: "Semiconductor Satellite", proposedRule: "固定DCA禁止；只做折價候選。" },
  { symbol: "DELL", name: "Dell", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "AI 伺服器供應鏈補位。", proposedRole: "AI Hardware Candidate", proposedRule: "只做折價；需毛利與庫存檢查。" },
  { symbol: "ARM", name: "Arm", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "CPU IP、生態授權與邊緣 AI。", proposedRole: "Semiconductor IP Candidate", proposedRule: "估值嚴審；只做折價候選。" },
  { symbol: "ORCL", name: "Oracle", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "資料庫與雲端基礎設施，受 AI 資料與雲端需求支撐。", proposedRole: "Cloud Infrastructure Candidate", proposedRule: "估值與負債嚴審；只做折價候選。" },
  { symbol: "NET", name: "Cloudflare", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "雲端網路、安全、邊緣運算與 AI 流量基礎設施。", proposedRole: "Cloud Network Candidate", proposedRule: "高估值高波動；只做深折價。" },
  { symbol: "NOW", name: "ServiceNow", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "企業工作流軟體 + AI 工作流平台。", proposedRole: "Software Candidate", proposedRule: "估值嚴審；只做折價候選。" },
  { symbol: "HUBB", name: "Hubbell", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "電網、電力設備與 AI 資料中心電力升級需求。", proposedRole: "Power Infrastructure Candidate", proposedRule: "只做折價；作為 AI 電力鏈補充。" },
  { symbol: "COIN", name: "Coinbase", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "加密金融基礎設施與交易所平台曝險。", proposedRole: "Crypto Financial Infrastructure", proposedRule: "高波動；只做深折價小額候選。" },
  { symbol: "SPCX", name: "SpaceX Tokenized Stock", bucket: "Confirmed Discount Buy Candidate", tier: "CONFIRMED_MAIN", reason: "SpaceX 代幣化曝險，屬 xStocks 特殊戰略候選。", proposedRole: "Strategic xStocks Candidate", proposedRule: "需資料源、流動性與上市以來高點檢查；小額處理。" },
];

const SECONDARY_WATCH = [
  { symbol: "LLY", name: "Eli Lilly", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "醫療/藥品需獨立政策與產品線審查，不混入 AI/xStocks 主線。", proposedRole: "Healthcare Watch", proposedRule: "暫不買；需專題重審。" },
  { symbol: "COST", name: "Costco", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "好公司但更像一般品質股，不是折價獵人主線。", proposedRole: "Quality Watch", proposedRule: "暫不買。" },
  { symbol: "SPOT", name: "Spotify", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "可觀察，但與 AI/xStocks 折價主線關聯較弱。", proposedRole: "Consumer Platform Watch", proposedRule: "暫不買。" },
  { symbol: "TMUS", name: "T-Mobile US", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "品質可看，但不是 Market 91 進攻主線。", proposedRole: "Telecom Watch", proposedRule: "暫不買。" },
  { symbol: "ACN", name: "Accenture", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "AI 服務敘事可看，但不是優先折價標的。", proposedRole: "IT Services Watch", proposedRule: "暫不買。" },
  { symbol: "REGN", name: "Regeneron", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "生技產品線、專利與研發風險需獨立審查。", proposedRole: "Biotech Watch", proposedRule: "暫不買。" },
  { symbol: "UNH", name: "UnitedHealth", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "政策、醫療成本與法律風險升高，需獨立審查。", proposedRole: "Healthcare Defensive Watch", proposedRule: "暫不買。" },
  { symbol: "SMCI", name: "Super Micro Computer", bucket: "Secondary Watch", tier: "SECONDARY_WATCH", reason: "AI 題材強，但治理、財報與波動風險高；暫不與核心 AI 同級。", proposedRole: "High Volatility AI Watch", proposedRule: "暫不買；只可專案重審。" },
];

function getMarket91Shortlist() {
  const rows = [...CONFIRMED_MARKET_91_MAIN_LIST, ...SECONDARY_WATCH];
  const buckets = rows.reduce((acc, item) => {
    acc[item.bucket] = (acc[item.bucket] || 0) + 1;
    return acc;
  }, {});
  return {
    version: "v17-market-91-final-shortlist-v1",
    source: "market_91_final_list_2026_07_09",
    policy: "confirmed_17_main_list_secondary_watch_not_buy_list",
    summary: {
      total: rows.length,
      confirmedMain: CONFIRMED_MARKET_91_MAIN_LIST.length,
      secondaryWatch: SECONDARY_WATCH.length,
      buckets,
    },
    confirmedMainList: CONFIRMED_MARKET_91_MAIN_LIST,
    secondaryWatch: SECONDARY_WATCH,
    rows,
  };
}

module.exports = { CONFIRMED_MARKET_91_MAIN_LIST, SECONDARY_WATCH, MARKET_91_SHORTLIST: [...CONFIRMED_MARKET_91_MAIN_LIST, ...SECONDARY_WATCH], getMarket91Shortlist };
