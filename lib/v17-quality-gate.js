const TODAY = "2026-07-08";

const STATUS_META = {
  PASSED: { label: "通過", tone: "green" },
  WATCH: { label: "觀察", tone: "yellow" },
  PENDING: { label: "未檢查", tone: "gray" },
  FAILED: { label: "失敗", tone: "red" },
};

const PIPELINE_META = {
  Draft: "外部稽核草稿，尚未逐項來源驗證",
  "Source Verified": "數字來源已驗證",
  "Rule Checked": "已套用 Quality Gate 門檻",
  Approved: "可作為 Quality Audit Center 正式結果",
  Rejected: "不符合規則或資料不足",
};

function permissions({ quality, role, special }) {
  if (quality === "FAILED") {
    return { fixedDca: "禁止", buyTheDip: "禁止", semiAutoDraft: "禁止", whitelistCandidate: false, existingPosition: "進入退出/減碼檢查，不自動賣出" };
  }
  if (special === "SPCX_NEW_LISTING") {
    return { fixedDca: "允許 5U", buyTheDip: "人工確認", semiAutoDraft: "人工確認", whitelistCandidate: false, existingPosition: "保留小額觀察；未滿資料條件不進自動交易" };
  }
  if (special === "RKLB_DEEP_DISCOUNT_ONLY") {
    return { fixedDca: "禁止", buyTheDip: "只深跌 -50/-65/-80", semiAutoDraft: "低優先人工確認", whitelistCandidate: false, existingPosition: "保留既有部位；平常不新增資金" };
  }
  if (quality === "WATCH") {
    return { fixedDca: role === "Satellite" ? "允許 5U，低優先" : "降低配置", buyTheDip: "低優先 / 人工確認", semiAutoDraft: "需手動確認", whitelistCandidate: false, existingPosition: "不主動減碼；停止高優先逢低" };
  }
  if (quality === "PENDING") {
    return { fixedDca: "僅保留既定小額", buyTheDip: "人工確認", semiAutoDraft: "需人工", whitelistCandidate: false, existingPosition: "保留既有小額觀察" };
  }
  return { fixedDca: "允許", buyTheDip: "允許", semiAutoDraft: "可草稿", whitelistCandidate: role === "Core" || role === "ETF Core" || role === "Cycle Core", existingPosition: "持續原策略" };
}

function stockRecord({ symbol, underlying, role, quality, objectiveScore, qualitativeScore, totalScore, financial, qualitative, majorFails = [], risk, pipeline = "Draft" }) {
  return {
    symbol,
    underlying,
    assetType: "Stock / xStock",
    role,
    auditDate: TODAY,
    nextReview: "下一次季報後 3 個工作天內 / 每季治理審查",
    pipeline,
    pipelineNote: PIPELINE_META[pipeline],
    sourceStatus: pipeline === "Draft" ? "Pending Verification" : "Verified",
    quality,
    qualityLabel: STATUS_META[quality]?.label || quality,
    tone: STATUS_META[quality]?.tone || "gray",
    scoringModel: "stock_18_point",
    objectiveScore,
    qualitativeScore,
    totalScore,
    majorFails,
    risk,
    financial,
    qualitative,
    permissions: permissions({ quality, role }),
  };
}

function specialRecord({ symbol, underlying, assetType, role, quality, score, totalScore, checks, qualitative, risk, pipeline = "Draft", special }) {
  return {
    symbol,
    underlying,
    assetType,
    role,
    auditDate: TODAY,
    nextReview: "下一次季報後 3 個工作天內 / 每季治理審查",
    pipeline,
    pipelineNote: PIPELINE_META[pipeline],
    sourceStatus: pipeline === "Draft" ? "Pending Verification" : "Verified",
    quality,
    qualityLabel: STATUS_META[quality]?.label || quality,
    tone: STATUS_META[quality]?.tone || "gray",
    scoringModel: assetType.includes("BTC") || symbol === "BTC" ? "btc_10_point" : assetType.includes("ETF") ? "etf_10_point" : "special_new_listing",
    objectiveScore: score,
    qualitativeScore: null,
    totalScore,
    checks,
    qualitative,
    majorFails: [],
    risk,
    permissions: permissions({ quality, role, special }),
  };
}

const QUALITY_AUDITS = [
  specialRecord({
    symbol: "BTC",
    underlying: "Bitcoin",
    assetType: "BTC / Crypto",
    role: "Cycle Core",
    quality: "PASSED",
    score: 8,
    totalScore: 8,
    risk: "週期波動與監管仍是主要風險；Quality 通過不代表可無限制加碼。",
    checks: [
      { name: "網路安全性", status: "通過", score: 2, reason: "安全性與共識機制仍維持高水位。" },
      { name: "流動性", status: "通過", score: 2, reason: "全球主要市場流動性仍屬頂級。" },
      { name: "長期採用趨勢", status: "通過", score: 2, reason: "ETF/機構採用敘事仍成立。" },
      { name: "監管風險", status: "觀察", score: 1, reason: "主要市場監管環境仍會造成波動。" },
      { name: "交易所/託管風險", status: "觀察", score: 1, reason: "交易所與託管風險仍需依賴資產安全控管。" },
    ],
  }),
  specialRecord({
    symbol: "QQQon",
    underlying: "Invesco QQQ / Nasdaq-100",
    assetType: "ETF / xStock",
    role: "ETF Core",
    quality: "PASSED",
    score: 9,
    totalScore: 9,
    risk: "成分集中度與科技股估值是主要風險。",
    checks: [
      { name: "指數代表性", status: "通過", score: 2, reason: "仍代表 Nasdaq-100 核心科技成長組合。" },
      { name: "成分集中風險", status: "觀察", score: 1, reason: "大型科技權重偏高，需接受集中度波動。" },
      { name: "長期成長邏輯", status: "通過", score: 2, reason: "科技與 AI 長期成長邏輯仍成立。" },
      { name: "費用率/流動性", status: "通過", score: 2, reason: "費用率與流動性仍適合作為 DCA 載體。" },
      { name: "穩定 DCA 標的", status: "通過", score: 2, reason: "仍適合作為核心穩定 DCA 標的。" },
    ],
  }),
  stockRecord({
    symbol: "NVDAon", underlying: "NVIDIA", role: "Core", quality: "PASSED", objectiveScore: 9, qualitativeScore: 8, totalScore: 17,
    risk: "估值與 AI 資本支出循環是主要風險；CapEx/供應鏈需求需持續追蹤。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "草稿判斷為高雙位數以上成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 強勁且自我造血；需來源驗證。" },
      { name: "毛利率", status: "通過", score: 2, reason: "毛利率維持高位，定價力仍強；需來源驗證。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "現金與流動性強，利息壓力低；需來源驗證。" },
      { name: "資本支出趨勢", status: "觀察", score: 1, reason: "AI 基礎設施週期中，需追蹤 CapEx 回報。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "AI GPU 領導地位仍明確。" },
      { name: "護城河", status: "通過", score: 2, reason: "CUDA 生態、軟硬體整合與規模優勢仍有效。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "長期執行力與產品路線仍獲市場驗證。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "AI 算力需求假設未被破壞。" },
    ],
  }),
  stockRecord({
    symbol: "TSMon", underlying: "TSMC", role: "Core", quality: "PASSED", objectiveScore: 10, qualitativeScore: 8, totalScore: 18,
    risk: "地緣政治、先進製程 CapEx 與客戶集中是主要風險。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "AI 與先進製程需求支撐成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 長期為正；需來源驗證。" },
      { name: "毛利率", status: "通過", score: 2, reason: "毛利率維持產業領先。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "財務體質穩健。" },
      { name: "資本支出趨勢", status: "通過", score: 2, reason: "CapEx 支援先進製程與長期需求。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "先進製程全球領導。" },
      { name: "護城河", status: "通過", score: 2, reason: "製程技術、良率、規模與客戶黏性構成護城河。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "長期資本配置與執行力穩定。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "AI 與高效能運算代工需求仍成立。" },
    ],
  }),
  stockRecord({
    symbol: "AVGOon", underlying: "Broadcom", role: "Core", quality: "PASSED", objectiveScore: 10, qualitativeScore: 8, totalScore: 18,
    risk: "AI networking 成長預期、併購整合與客戶集中需追蹤。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "AI/networking 與軟體業務支撐成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 轉換率強；需來源驗證。" },
      { name: "毛利率", status: "通過", score: 2, reason: "毛利率維持高水準。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "財務與現金流足以支撐槓桿。" },
      { name: "資本支出趨勢", status: "通過", score: 2, reason: "CapEx 相對可控。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "AI networking / ASIC 與基礎設施軟體地位強。" },
      { name: "護城河", status: "通過", score: 2, reason: "客戶關係、產品組合與軟體黏性形成護城河。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "資本配置與併購整合能力長期強。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "AI 基礎設施與高利潤軟體假設仍成立。" },
    ],
  }),
  stockRecord({
    symbol: "GOOGLon", underlying: "Alphabet", role: "Core", quality: "PASSED", objectiveScore: 9, qualitativeScore: 8, totalScore: 17,
    risk: "AI CapEx、搜尋商業模式競爭與監管是主要風險。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "廣告與 Cloud 仍支撐成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 強健但 AI CapEx 需追蹤。" },
      { name: "毛利率", status: "通過", score: 2, reason: "高毛利商業模式仍在。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "現金與短投充足。" },
      { name: "資本支出趨勢", status: "觀察", score: 1, reason: "AI / Cloud 投資高，需追蹤回報。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "搜尋、YouTube、Cloud 與 AI 平台仍在核心位置。" },
      { name: "護城河", status: "通過", score: 2, reason: "資料、分發、品牌與生態系仍強。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "長期研發與資本配置仍可接受。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "平台型現金流 + AI 轉型假設仍成立。" },
    ],
  }),
  stockRecord({
    symbol: "AMDon", underlying: "AMD", role: "Satellite", quality: "PASSED", objectiveScore: 10, qualitativeScore: 8, totalScore: 18,
    risk: "AI GPU 競爭強度、毛利率與資料中心滲透率需追蹤；Quality 通過不等於升級核心。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "資料中心與 AI 需求支撐成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 改善；需來源驗證。" },
      { name: "毛利率", status: "通過", score: 2, reason: "毛利率改善中。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "資產負債表可控。" },
      { name: "資本支出趨勢", status: "通過", score: 2, reason: "CapEx 與研發投入尚屬合理。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "CPU 與 AI 加速器仍具競爭地位。" },
      { name: "護城河", status: "通過", score: 2, reason: "產品組合與資料中心客戶基礎擴張。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "管理層長期執行力佳。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "AI / Data Center 衛星配置假設仍成立。" },
    ],
  }),
  stockRecord({
    symbol: "MRVLon", underlying: "Marvell", role: "Satellite", quality: "PASSED", objectiveScore: 9, qualitativeScore: 8, totalScore: 17,
    risk: "AI networking 成長節奏、客戶集中與週期波動需追蹤；Quality 通過不等於升級核心。",
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "資料中心與 AI networking 帶動成長；需來源驗證。" },
      { name: "自由現金流", status: "通過", score: 2, reason: "FCF 為正；需來源驗證。" },
      { name: "毛利率", status: "通過", score: 2, reason: "毛利率改善，仍需追蹤產品組合。" },
      { name: "資產負債表", status: "通過", score: 2, reason: "資產負債表可控。" },
      { name: "資本支出趨勢", status: "觀察", score: 1, reason: "成長投入與週期性需觀察。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "資料中心連接與客製晶片仍具定位。" },
      { name: "護城河", status: "通過", score: 2, reason: "客戶關係與技術能力支撐競爭力。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "管理層執行方向聚焦 AI / Data Center。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "AI networking 衛星配置假設仍成立。" },
    ],
  }),
  stockRecord({
    symbol: "RKLBon", underlying: "Rocket Lab", role: "Spec Watch", quality: "WATCH", objectiveScore: 5, qualitativeScore: 7, totalScore: 12,
    risk: "FCF 為負與 Neutron 開發燒錢是一票否決級觀察項；禁止固定 DCA。",
    majorFails: ["自由現金流失敗：最高只能觀察，不得通過"],
    financial: [
      { name: "營收成長", status: "通過", score: 2, reason: "成長與 backlog 支撐投資假設；需來源驗證。" },
      { name: "自由現金流", status: "失敗", score: 0, reason: "FCF 仍為負，成長階段燒錢。" },
      { name: "毛利率", status: "觀察", score: 1, reason: "毛利率改善但仍需穩定。" },
      { name: "資產負債表", status: "觀察", score: 1, reason: "現金可支撐但仍屬高燒錢階段。" },
      { name: "資本支出趨勢", status: "觀察", score: 1, reason: "Neutron 等開發支出需追蹤回報。" },
    ],
    qualitative: [
      { name: "產業領導地位", status: "通過", score: 2, reason: "小型發射與太空系統仍具差異化。" },
      { name: "護城河", status: "觀察", score: 1, reason: "護城河仍在建立中。" },
      { name: "管理層品質", status: "通過", score: 2, reason: "執行力與任務紀錄具市場信任。" },
      { name: "投資假設是否成立", status: "通過", score: 2, reason: "太空基礎設施成長假設仍成立，但財務未成熟。" },
    ],
  }),
  specialRecord({
    symbol: "SPCXon",
    underlying: "SpaceX / SPCX",
    assetType: "New Listing / xStock",
    role: "Data Pending",
    quality: "PENDING",
    score: null,
    totalScore: null,
    special: "SPCX_NEW_LISTING",
    risk: "新上市 / 交易歷史不足；未滿 52 週，不得使用完整 52 週高點框架。",
    checks: [
      { name: "上市歷史", status: "未檢查", score: null, reason: "交易歷史不足，需使用上市以來高點。" },
      { name: "財報完整度", status: "未檢查", score: null, reason: "需至少兩季公開資料後再完整稽核。" },
      { name: "高點基準", status: "人工確認", score: null, reason: "逢低訊號必須驗證高點來源。" },
    ],
  }),
];

function getQualityAudits() {
  return QUALITY_AUDITS;
}

function getQualityAudit(symbol) {
  const key = String(symbol || "").toUpperCase();
  return QUALITY_AUDITS.find((x) => String(x.symbol).toUpperCase() === key || String(x.underlying).toUpperCase() === key);
}

function qualitySummary() {
  return QUALITY_AUDITS.reduce((acc, item) => {
    acc.total += 1;
    acc[item.quality] = (acc[item.quality] || 0) + 1;
    acc.draft += item.pipeline === "Draft" ? 1 : 0;
    return acc;
  }, { total: 0, PASSED: 0, WATCH: 0, PENDING: 0, FAILED: 0, draft: 0 });
}

module.exports = { getQualityAudits, getQualityAudit, qualitySummary, STATUS_META, PIPELINE_META };
