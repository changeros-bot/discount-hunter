const MOCK_INVOICES = [
  {
    id: "mock-20260704-familymart-85",
    invoiceNo: "AA00000001",
    date: "2026-07-04",
    time: "08:12",
    merchant: "全家",
    amount: 85,
    suggestedCategory: "菸",
    account: "自用",
    isLivingExpense: "Y",
    isFixedExpense: "N",
    affectsBudget: "Y",
    status: "待確認",
    confidence: 0.72,
    reason: "超商小額消費，金額接近常見菸品；需人工確認。"
  },
  {
    id: "mock-20260704-seven-80",
    invoiceNo: "AA00000002",
    date: "2026-07-04",
    time: "07:35",
    merchant: "7-ELEVEN",
    amount: 80,
    suggestedCategory: "早餐",
    account: "自用",
    isLivingExpense: "Y",
    isFixedExpense: "N",
    affectsBudget: "Y",
    status: "待確認",
    confidence: 0.66,
    reason: "早上超商小額消費，暫列早餐候選。"
  },
  {
    id: "mock-20260703-louisa-55",
    invoiceNo: "AA00000003",
    date: "2026-07-03",
    time: "14:10",
    merchant: "路易莎咖啡",
    amount: 55,
    suggestedCategory: "咖啡",
    account: "自用",
    isLivingExpense: "Y",
    isFixedExpense: "N",
    affectsBudget: "Y",
    status: "待確認",
    confidence: 0.9,
    reason: "店家名稱包含咖啡，分類可信度較高。"
  }
];

function summarize(invoices) {
  const totalAmount = invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingCount = invoices.filter((item) => item.status === "待確認").length;
  return { count: invoices.length, pendingCount, totalAmount };
}

export default function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const hasCarrierConfig = Boolean(process.env.EINVOICE_CARD_NO && process.env.EINVOICE_CARD_ENCRYPT);
  const invoices = MOCK_INVOICES;

  return res.status(200).json({
    ok: true,
    mode: hasCarrierConfig ? "configured_stub" : "mock",
    source: hasCarrierConfig ? "carrier_env_configured_stub" : "mock_invoice_adapter",
    message: hasCarrierConfig
      ? "載具環境變數已存在；正式財政部 adapter 尚未啟用，目前先回傳待確認資料結構。"
      : "尚未設定載具憑證，先回傳 mock 發票資料供 UI 與分類流程測試。",
    updatedAt: new Date().toISOString(),
    summary: summarize(invoices),
    invoices
  });
}
