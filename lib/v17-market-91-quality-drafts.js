const TODAY = "2026-07-08";

const CHECKS = {
  pass: (name, reason) => ({ name, status: "通過", score: 2, reason }),
  watch: (name, reason) => ({ name, status: "觀察", score: 1, reason }),
  fail: (name, reason) => ({ name, status: "失敗", score: 0, reason }),
};

function score(items) {
  return items.reduce((sum, x) => sum + Number(x.score || 0), 0);
}
function qualityFrom(total, majorFails = []) {
  if (majorFails.length) return "WATCH";
  if (total >= 14) return "PASSED_DRAFT";
  if (total >= 9) return "WATCH";
  return "FAILED_DRAFT";
}
function permissionFrom(item) {
  if (item.quality === "PASSED_DRAFT") {
    return {
      officialList: false,
      fixedDca: "禁止",
      buyTheDip: item.rule || "可列折價候選，但需人工確認",
      semiAutoDraft: "禁止，待正式 Quality Approved",
      autoWhitelist: false,
    };
  }
  if (item.quality === "WATCH") {
    return { officialList: false, fixedDca: "禁止", buyTheDip: "觀察，不產生草稿", semiAutoDraft: "禁止", autoWhitelist: false };
  }
  return { officialList: false, fixedDca: "禁止", buyTheDip: "禁止", semiAutoDraft: "禁止", autoWhitelist: false };
}
function record({ symbol, name, bucket, role, rule, thesis, risk, financial, qualitative, majorFails = [] }) {
  const objectiveScore = score(financial);
  const qualitativeScore = score(qualitative);
  const totalScore = objectiveScore + qualitativeScore;
  const item = {
    symbol,
    name,
    bucket,
    role,
    rule,
    auditDate: TODAY,
    pipeline: "Draft",
    sourceStatus: "Pending Verification",
    scoringModel: "stock_18_point_draft",
    objectiveScore,
    qualitativeScore,
    totalScore,
    majorFails,
    quality: qualityFrom(totalScore, majorFails),
    thesis,
    risk,
    financial,
    qualitative,
  };
  item.permissions = permissionFrom(item);
  return item;
}

const MARKET_91_QUALITY_DRAFTS = [
  record({
    symbol: "QCOM", name: "Qualcomm", bucket: "科技 / 半導體", role: "Semiconductor Satellite Candidate",
    rule: "折價候選；固定DCA禁止；需避免與既有半導體過度重疊。",
    thesis: "補強半導體與邊緣 AI / 連線晶片曝險，與 NVDA / AVGO 不完全重疊。",
    risk: "手機週期、客戶集中、授權業務與競爭壓力需驗證。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：週期波動後仍有 AI/邊緣運算與車用機會，需來源驗證。"), CHECKS.pass("自由現金流", "草稿判斷：長期 FCF 能力較佳，需來源驗證。"), CHECKS.pass("毛利率", "草稿判斷：授權/IP 業務支撐利潤，需來源驗證。"), CHECKS.pass("資產負債表", "草稿判斷：財務體質可審，需來源驗證。"), CHECKS.watch("資本支出趨勢", "半導體週期與投資節奏需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "手機通訊晶片與 IP 地位明確。"), CHECKS.pass("護城河", "專利/IP/客戶關係形成護城河。"), CHECKS.watch("管理層品質", "需驗證資本配置與併購紀錄。"), CHECKS.pass("投資假設是否成立", "邊緣 AI、車用、連線晶片仍有長期敘事。")],
  }),
  record({
    symbol: "ORCL", name: "Oracle", bucket: "雲端 / 資料庫", role: "Cloud Infrastructure Candidate",
    rule: "折價候選；固定DCA禁止；估值與負債需審。",
    thesis: "資料庫與雲端基礎設施，受 AI 資料與雲端需求支撐。",
    risk: "雲端競爭、CapEx、負債與估值需驗證。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：雲端成長支撐，需來源驗證。"), CHECKS.pass("自由現金流", "軟體/資料庫業務理論上具現金流，需來源驗證。"), CHECKS.pass("毛利率", "軟體與雲端組合應具較高毛利，需來源驗證。"), CHECKS.watch("資產負債表", "併購與雲端投資後負債需驗證。"), CHECKS.watch("資本支出趨勢", "AI 雲端 CapEx 可能上升，需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "資料庫與企業 IT 地位明確。"), CHECKS.pass("護城河", "企業客戶與資料庫黏著度高。"), CHECKS.watch("管理層品質", "需驗證雲端轉型執行力。"), CHECKS.pass("投資假設是否成立", "AI/雲端資料需求仍支撐長期敘事。")],
  }),
  record({
    symbol: "DELL", name: "Dell", bucket: "AI 伺服器鏈", role: "AI Hardware Candidate",
    rule: "只做折價；固定DCA禁止；需毛利與庫存檢查。",
    thesis: "AI 伺服器與企業硬體供應鏈補位。",
    risk: "硬體毛利、庫存週期、競爭與需求波動。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：AI 伺服器需求可支撐，需來源驗證。"), CHECKS.watch("自由現金流", "硬體週期導致 FCF 需驗證。"), CHECKS.watch("毛利率", "AI 伺服器可能高營收低毛利，需嚴審。"), CHECKS.watch("資產負債表", "槓桿與回購需驗證。"), CHECKS.watch("資本支出趨勢", "營運資金與庫存週期需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "企業硬體與伺服器品牌/通路明確。"), CHECKS.watch("護城河", "硬體護城河不如晶片/軟體，需觀察。"), CHECKS.watch("管理層品質", "需驗證 AI 伺服器執行與毛利管理。"), CHECKS.pass("投資假設是否成立", "AI 伺服器需求仍是可研究假設。")],
  }),
  record({
    symbol: "NOW", name: "ServiceNow", bucket: "企業軟體", role: "Software Candidate",
    rule: "折價候選；估值嚴審；固定DCA禁止。",
    thesis: "企業工作流軟體 + AI 工作流平台，具長期企業黏性。",
    risk: "高估值、企業 IT 預算與 AI 變現速度。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：企業 SaaS 成長，需來源驗證。"), CHECKS.pass("自由現金流", "SaaS 模型理論上 FCF 較佳，需來源驗證。"), CHECKS.pass("毛利率", "軟體毛利較高，需來源驗證。"), CHECKS.pass("資產負債表", "財務體質需驗證，草稿暫通過。"), CHECKS.watch("資本支出趨勢", "AI 投入與 SBC 需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "企業工作流平台地位明確。"), CHECKS.pass("護城河", "企業流程黏性與替換成本較高。"), CHECKS.pass("管理層品質", "長期執行力草稿評為佳，需來源驗證。"), CHECKS.pass("投資假設是否成立", "AI 工作流與企業自動化敘事成立。")],
  }),
  record({
    symbol: "NET", name: "Cloudflare", bucket: "雲端網路 / 安全", role: "Cloud Network Candidate",
    rule: "只深折價；固定DCA禁止；高估值高波動。",
    thesis: "雲端網路、安全、邊緣運算與 AI 流量基礎設施。",
    risk: "估值、競爭、FCF 成熟度與成長放緩風險。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：成長性仍可研究，需來源驗證。"), CHECKS.watch("自由現金流", "成長公司 FCF 品質需驗證。"), CHECKS.pass("毛利率", "網路軟體服務毛利理論上較佳，需驗證。"), CHECKS.watch("資產負債表", "資金與 SBC 需驗證。"), CHECKS.watch("資本支出趨勢", "網路基礎建設投資需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "邊緣網路與安全品牌清楚。"), CHECKS.pass("護城河", "全球網路、產品整合與開發者生態構成護城河。"), CHECKS.watch("管理層品質", "需驗證執行與盈利路徑。"), CHECKS.pass("投資假設是否成立", "AI/雲端流量長期增加支撐敘事。")],
  }),
  record({
    symbol: "META", name: "Meta", bucket: "大型平台 / AI", role: "Platform Candidate",
    rule: "折價候選；需避免與 GOOGL 過度重疊。",
    thesis: "大型社群平台現金流 + AI 推薦/廣告/模型基礎設施。",
    risk: "監管、廣告景氣、AI/元宇宙 CapEx 回收。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：廣告與 AI 改善支撐，需來源驗證。"), CHECKS.pass("自由現金流", "大型平台 FCF 強，需來源驗證。"), CHECKS.pass("毛利率", "平台毛利結構佳，需來源驗證。"), CHECKS.pass("資產負債表", "大型平台財務體質草稿通過，需來源驗證。"), CHECKS.watch("資本支出趨勢", "AI 與 Reality Labs CapEx 需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "全球社群平台與廣告地位明確。"), CHECKS.pass("護城河", "社交圖譜、規模與廣告系統。"), CHECKS.pass("管理層品質", "成本控制與 AI 投入執行需持續追蹤。"), CHECKS.pass("投資假設是否成立", "AI 推薦與廣告效率改善敘事仍可研究。")],
  }),
  record({
    symbol: "HUBB", name: "Hubbell", bucket: "電力 / 工業基礎建設", role: "Infrastructure Candidate",
    rule: "折價候選；可作 AI 電力鏈補充。",
    thesis: "電網、電力設備與工業基礎設施受 AI 資料中心與電力升級需求支撐。",
    risk: "工業週期、估值、訂單與電力投資節奏。",
    financial: [CHECKS.pass("營收成長", "草稿判斷：電力基建需求支撐，需來源驗證。"), CHECKS.pass("自由現金流", "工業龍頭 FCF 需驗證，草稿暫通過。"), CHECKS.pass("毛利率", "電氣設備定價力需驗證，草稿暫通過。"), CHECKS.pass("資產負債表", "需來源驗證，草稿暫通過。"), CHECKS.watch("資本支出趨勢", "擴產與景氣循環需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "電力/電氣設備供應鏈位置清楚。"), CHECKS.pass("護城河", "產品線、客戶關係與通路構成護城河。"), CHECKS.watch("管理層品質", "需驗證長期資本配置。"), CHECKS.pass("投資假設是否成立", "AI 資料中心帶動電力基建升級敘事成立。")],
  }),
  record({
    symbol: "REGN", name: "Regeneron", bucket: "醫療 / 生技品質", role: "Healthcare Quality Candidate",
    rule: "折價候選；需產品線與專利風險審查。",
    thesis: "高品質生技/製藥候選，提供非科技分散。",
    risk: "產品集中、研發失敗、專利到期與監管風險。",
    financial: [CHECKS.watch("營收成長", "藥品週期與產品線需驗證。"), CHECKS.pass("自由現金流", "成熟生技公司 FCF 可審，需來源驗證。"), CHECKS.pass("毛利率", "藥品毛利結構通常較高，需來源驗證。"), CHECKS.pass("資產負債表", "需來源驗證，草稿暫通過。"), CHECKS.watch("資本支出趨勢", "研發支出與 pipeline 風險需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "特定治療領域地位需驗證，草稿暫通過。"), CHECKS.pass("護城河", "研發能力與產品組合構成護城河。"), CHECKS.watch("管理層品質", "研發與商業化執行需驗證。"), CHECKS.watch("投資假設是否成立", "需驗證 pipeline 是否足以支撐長期。")],
  }),
  record({
    symbol: "UNH", name: "UnitedHealth", bucket: "醫療 / 防禦成長", role: "Healthcare Defensive Candidate",
    rule: "折價候選；需政策風險標籤。",
    thesis: "醫療保險與醫療服務龍頭，作為防禦成長分散。",
    risk: "政策監管、醫療成本率、法律與聲譽風險。",
    financial: [CHECKS.watch("營收成長", "政策與醫療成本影響需驗證。"), CHECKS.pass("自由現金流", "成熟大型醫療服務商 FCF 需來源驗證。"), CHECKS.watch("毛利率", "醫療成本率與政策限制需觀察。"), CHECKS.pass("資產負債表", "大型公司財務體質需驗證。"), CHECKS.watch("資本支出趨勢", "併購與醫療服務投資需觀察。")],
    qualitative: [CHECKS.pass("產業領導地位", "醫療保險/服務規模優勢明確。"), CHECKS.pass("護城河", "規模、資料、網絡與服務整合。"), CHECKS.watch("管理層品質", "監管與營運執行需驗證。"), CHECKS.watch("投資假設是否成立", "政策風險升高時需重審。")],
  }),
  record({
    symbol: "EQT", name: "EQT", bucket: "能源 / 天然氣", role: "Cycle Candidate",
    rule: "不固定DCA；只深折價；低權重。",
    thesis: "天然氣供給與能源週期候選，開放非科技配置。",
    risk: "天然氣價格、週期、槓桿、政策與商品價格波動。",
    financial: [CHECKS.watch("營收成長", "高度受天然氣價格影響。"), CHECKS.watch("自由現金流", "商品週期下 FCF 需嚴格驗證。"), CHECKS.watch("毛利率", "能源價格與成本波動高。"), CHECKS.watch("資產負債表", "能源公司槓桿需嚴審。"), CHECKS.watch("資本支出趨勢", "CapEx 與產量紀律是核心風險。")],
    qualitative: [CHECKS.pass("產業領導地位", "天然氣生產商位置可審。"), CHECKS.watch("護城河", "商品型公司護城河較弱。"), CHECKS.watch("管理層品質", "資本紀律需驗證。"), CHECKS.watch("投資假設是否成立", "天然氣長期需求與價格假設需明確。")],
  }),
];

function getMarket91QualityDrafts() {
  const summary = MARKET_91_QUALITY_DRAFTS.reduce((acc, item) => {
    acc.total += 1;
    acc[item.quality] = (acc[item.quality] || 0) + 1;
    acc.buckets[item.bucket] = (acc.buckets[item.bucket] || 0) + 1;
    return acc;
  }, { total: 0, PASSED_DRAFT: 0, WATCH: 0, FAILED_DRAFT: 0, buckets: {} });
  return {
    version: "v17-market-91-quality-draft-v1",
    source: "market_91_shortlist_deep_review",
    policy: "draft_only_pending_source_verification_not_official_watchlist",
    summary,
    rows: MARKET_91_QUALITY_DRAFTS,
  };
}

module.exports = { MARKET_91_QUALITY_DRAFTS, getMarket91QualityDrafts };
