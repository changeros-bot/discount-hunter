export const ENGINES = Object.freeze({
  INVESTMENT: "investment",
  TACTICAL: "tactical"
});

export const STRATEGIES = Object.freeze({
  PURE_DCA: "pure_dca",
  DCA_DISCOUNT: "dca_discount",
  DISCOUNT_ONLY: "discount_only",
  LEVERAGED_HUNTER: "leveraged_hunter",
  TREND: "trend",
  SWING: "swing"
});

export const ASSET_STATUS = Object.freeze({
  QUALIFIED: "qualified",
  WATCH: "watch",
  RESEARCH_QUEUE: "research_queue"
});

export const ASSET_REGISTRY = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "crypto",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DCA_DISCOUNT,
    tags: ["store_of_value", "crypto", "macro_liquidity", "high_volatility"],
    conviction: "A-",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Security thesis break, regulatory shock, liquidity regime change, or cycle model failure.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "btc_cycle_high_v1",
    referenceMode: "cycle_high",
    cycleHigh: 126198,
    cycleHighDate: "2025-10-07",
    cycleHighSource: "V17 BTC baseline from Binance BTC/USDT info screen; update only by confirmed_breakout_30d.",
    updatePolicy: "confirmed_breakout_30d",
    cycleHighUpdateRule: "Update cycleHigh only after BTC trades above the old cycleHigh for 30 consecutive days; until then keep the old anchor.",
    unitAmount: 5,
    capitalUnits: [1, 3, 6, 5, 5],
    modes: ["dca", "discount_buy"],
    backtestConclusion: "BTC_B performed better than BTC_A. Use deeper cycle layers; BTC remains independent cycle engine.",
    rules: [-25, -40, -55, -70, -85],
    amounts: [5, 15, 30, 25, 25]
  },
  {
    symbol: "QQQon",
    name: "Invesco QQQ",
    assetType: "tokenized_stock_etf",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DCA_DISCOUNT,
    tags: ["nasdaq_100", "growth", "tokenized_stock"],
    conviction: "A+",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Index methodology change, token liquidity issue, or stronger replacement appears.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "核心ETF｜Nasdaq 100｜ETF可淺買",
    backtestConclusion: "ETF_B won: 3 layers are enough; no need for -50% layer.",
    rules: [-15, -25, -35],
    amounts: [5, 10, 15]
  },
  {
    symbol: "NVDAon",
    name: "NVIDIA",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["ai", "gpu", "semiconductor", "tokenized_stock"],
    conviction: "A",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "AI capex slowdown, competitive displacement, or valuation thesis break.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "AI基建A級｜AI GPU核心龍頭｜中深買",
    backtestConclusion: "AI infrastructure should not buy too early. Use 4 medium-deep layers.",
    rules: [-25, -35, -45, -60],
    amounts: [5, 10, 15, 20]
  },
  {
    symbol: "TSMon",
    name: "Taiwan Semiconductor",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["foundry", "semiconductor", "ai_supply_chain", "tokenized_stock"],
    conviction: "A",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Process leadership loss, geopolitical risk repricing, or demand collapse.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "AI基建A級｜全球先進製程龍頭｜中深買",
    backtestConclusion: "TSM supports AI_B/AI_C deeper layer logic.",
    rules: [-25, -35, -45, -60],
    amounts: [5, 10, 15, 20]
  },
  {
    symbol: "AVGOon",
    name: "Broadcom",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["ai_networking", "asic", "semiconductor", "tokenized_stock"],
    conviction: "A",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "AI networking thesis break, acquisition risk, or margin deterioration.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "AI基建A級｜AI網路 + ASIC龍頭｜中深買",
    backtestConclusion: "Best backtest profile among AI assets; AI_C layers were strongest.",
    rules: [-25, -35, -45, -60],
    amounts: [5, 10, 15, 20]
  },
  {
    symbol: "SPCXon",
    name: "SpaceX",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["space", "high_growth", "tokenized_stock"],
    conviction: "A-",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Token liquidity issue, product terms change, or valuation anchor becomes unreliable.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_since_listing_high_v1",
    description: "高成長太空龍頭｜暫不更新買點，待專用資料源",
    backtestConclusion: "SPCXon should use since-listing high, but implementation is paused until reliable xStocks historical data is available.",
    rules: [-20, -35, -50, -65],
    amounts: [5, 10, 15, 20]
  },
  {
    symbol: "GOOGLon",
    name: "Alphabet",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["ai", "search", "cloud", "tokenized_stock"],
    conviction: "B+",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Search moat erosion, cloud underperformance, or AI monetization failure.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "平台型｜AI + 搜尋 + 雲端｜3層即可",
    backtestConclusion: "GOOGL does not need 4 layers. Three platform layers are enough.",
    rules: [-20, -30, -40],
    amounts: [5, 10, 15]
  },
  {
    symbol: "AMDon",
    name: "Advanced Micro Devices",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["ai", "gpu_challenger", "semiconductor", "tokenized_stock"],
    conviction: "B",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "GPU roadmap miss, margin pressure, or AI share loss.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "AI基建B級｜AI GPU挑戰者｜中深買、降權重",
    backtestConclusion: "Positive expectation but larger adverse drawdowns than A-grade AI assets. Keep layers, reduce sizing.",
    rules: [-25, -35, -45, -60],
    amounts: [5, 5, 10, 15]
  },
  {
    symbol: "MRVLon",
    name: "Marvell",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["ai_networking", "asic", "semiconductor", "tokenized_stock"],
    conviction: "C+",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "AI networking thesis weakens, design win miss, or balance sheet risk rises.",
    status: ASSET_STATUS.QUALIFIED,
    discountModel: "xstock_52w_v1",
    description: "AI基建B級｜AI網通與ASIC供應鏈｜中深買、降權重",
    backtestConclusion: "Keep only as lower-priority AI infrastructure. Same layers, lower sizing.",
    rules: [-25, -35, -45, -60],
    amounts: [5, 10, 10, 15]
  },
  {
    symbol: "RKLBon",
    name: "Rocket Lab",
    assetType: "tokenized_stock",
    engine: ENGINES.INVESTMENT,
    strategy: STRATEGIES.DISCOUNT_ONLY,
    tags: ["space", "small_cap_growth", "high_risk", "tokenized_stock"],
    conviction: "C",
    reviewFrequency: "quarterly",
    reEvaluateTrigger: "Execution miss, liquidity problem, or thesis no longer compensates for risk.",
    status: ASSET_STATUS.WATCH,
    discountModel: "xstock_52w_v1",
    description: "高波動成長｜高風險太空成長股｜深買、少出手",
    backtestConclusion: "RKLB has low win rate and high adverse drawdown. Deeper layers only; keep watch status.",
    rules: [-50, -65, -80],
    amounts: [5, 10, 15]
  },
  {
    symbol: "00631L",
    name: "元大台灣50正2",
    assetType: "leveraged_etf",
    engine: ENGINES.TACTICAL,
    strategy: STRATEGIES.LEVERAGED_HUNTER,
    tags: ["taiwan", "leveraged", "tactical"],
    conviction: "Tactical",
    reviewFrequency: "monthly",
    reEvaluateTrigger: "Trend regime changes, drawdown exceeds plan, or leverage rules change.",
    status: ASSET_STATUS.WATCH,
    discountModel: null,
    rules: [],
    amounts: []
  }
];

export function getAssetRegistry({ status } = {}) {
  return status ? ASSET_REGISTRY.filter((asset) => asset.status === status) : ASSET_REGISTRY;
}

export function getAssetBySymbol(symbol) {
  const key = String(symbol || "").trim().toUpperCase();
  return ASSET_REGISTRY.find((asset) => asset.symbol.toUpperCase() === key) || null;
}

export function getAssetsByEngine(engine) {
  return ASSET_REGISTRY.filter((asset) => asset.engine === engine);
}

export function getQualifiedInvestmentAssets() {
  return ASSET_REGISTRY.filter((asset) => asset.engine === ENGINES.INVESTMENT && asset.status === ASSET_STATUS.QUALIFIED);
}
