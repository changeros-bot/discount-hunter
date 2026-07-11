const RULES = {
  // Market45
  NOW: { profile: "growth_software", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "SaaS / AI workflow 高估值成長股，不追高，只看中深折價。" },
  QCOM: { profile: "semiconductor_handset_cycle", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "QCOM 不是純 AI 半導體；手機週期、QCT handset、QTL 授權、Android OEM demand 需更深買點，不給偏好加分。" },
  DELL: { profile: "ai_hardware_margin", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "AI server 需求強，但硬體毛利與庫存週期風險高，買點需更深。" },
  REGN: { profile: "biotech_quality", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "生技品質股；EYLEA / pipeline / FDA 風險需追蹤，需較深折價。" },

  // Market91 Audit
  MA: { profile: "quality_defensive_payment", referenceMode: "52w_high_or_fallback", rules: [-10, -20, -30], amounts: [5, 10, 15], note: "支付網路高品質，通常不等極深折價，但估值仍需扣分。" },
  V: { profile: "quality_defensive_payment", referenceMode: "52w_high_or_fallback", rules: [-10, -20, -30], amounts: [5, 10, 15], note: "支付網路高品質，通常不等極深折價，但估值與監管風險需追蹤。" },
  COST: { profile: "quality_defensive_retail", referenceMode: "52w_high_or_fallback", rules: [-10, -20, -30], amounts: [5, 10, 15], note: "會員制零售高品質，但估值常偏高，只做分層折價。" },
  TMUS: { profile: "defensive_fcf_telecom_leverage_adjusted", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35], amounts: [5, 10, 15], note: "TMUS 雖有防禦與 FCF 特性，但電信負債、capex、頻譜成本與競爭壓力不適合 -10% 太淺買點。" },

  PWR: { profile: "ai_power_infrastructure", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "AI 電力基建成長股，工程執行與估值風險需中深折價。" },
  CEG: { profile: "ai_power_nuclear", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "核能 / AI 電力題材，政策與電價風險需中深折價。" },
  GEV: { profile: "ai_power_equipment", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "電網 / 發電設備成長題材，上市時間與執行風險需中深折價。" },
  SPOT: { profile: "growth_subscription", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "數位訂閱平台，估值與內容成本風險需中深折價。" },
  ACN: { profile: "ai_services_consulting", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 5, 10, 15], note: "AI transformation 服務商，企業 IT 支出循環需中深折價。" },

  LLY: { profile: "biotech_pharma_glp1", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "GLP-1 / 製藥高品質但估值與政策風險高，需較深折價。" },

  // Market10 Discount Candidates
  MSFT: { profile: "mega_cap_ai_cloud", referenceMode: "52w_high_or_fallback", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20], note: "Microsoft 品質高，但 AI capex / Azure 增速 / Xbox 重組壓力需追蹤；不追高，只做折價。" },
  NFLX: { profile: "streaming_platform_quality", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "Netflix 盈利能力佳，但用戶參與度、內容成本、廣告變現與競爭需較深折價。" },
  ADBE: { profile: "software_ai_disruption", referenceMode: "52w_high_or_fallback", rules: [-20, -30, -40, -55], amounts: [5, 5, 10, 15], note: "Adobe 現金流強，但 AI 競爭、Firefly 變現與成長放緩需較深買點。" },
  SOFI: { profile: "high_risk_fintech_credit_cycle", referenceMode: "52w_high_or_fallback", rules: [-30, -45, -60, -75], amounts: [3, 5, 7, 10], note: "SoFi 成長快但屬高風險 fintech / 信用週期股，不列優質股；紙上小額壓力測試。" },
};

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

export function getPaperDiscountRule(symbol) {
  const key = normalize(symbol);
  return RULES[key] || null;
}

export function formatDiscountEntry(rule) {
  if (!rule?.rules?.length) return "尚未設定折價買點。";
  return `參考高點：${rule.referenceMode || "52w_high_or_fallback"}；折價層級：${rule.rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}`;
}

export function formatDiscountSizing(rule) {
  if (!rule?.amounts?.length) return "每筆 5U 紙上測試。";
  return `層級金額：${rule.amounts.map((x, i) => `D${i + 1} ${x}U`).join(" / ")}`;
}

export function applyPaperDiscountRule(asset = {}) {
  const rule = getPaperDiscountRule(asset.symbol);
  if (!rule) return asset;
  const playbook = asset.playbook || {};
  return {
    ...asset,
    discountModel: "paper_discount_rule_v1",
    referenceMode: rule.referenceMode,
    profile: rule.profile,
    rules: rule.rules,
    amounts: rule.amounts,
    ruleNote: rule.note,
    playbook: {
      ...playbook,
      entryRule: formatDiscountEntry(rule),
      sizing: formatDiscountSizing(rule),
      buyPointRule: formatDiscountEntry(rule),
      ruleNote: rule.note,
    },
  };
}

export function getAllPaperDiscountRules() {
  return { ...RULES };
}
