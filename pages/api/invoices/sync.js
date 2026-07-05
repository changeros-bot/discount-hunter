function demoInvoices() {
  return [
    {
      id: "demo-7eleven-20260705-001",
      invoiceNo: "DEMO000001",
      date: "2026-07-05",
      merchant: "7-ELEVEN",
      amount: 80,
      suggestedCategory: "飲食",
      suggestedDetail: "早餐",
      confidence: 0.72,
      source: "demo",
      status: "待確認",
    },
    {
      id: "demo-telecom-20260702-001",
      invoiceNo: "DEMO000002",
      date: "2026-07-02",
      merchant: "電信帳單",
      amount: 1773,
      suggestedCategory: "手機月租費",
      suggestedDetail: "手機月租費",
      confidence: 0.86,
      source: "demo",
      status: "待確認",
    },
  ];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { carrier, verifyCode, since, until } = req.body || {};
  const hasCarrierInput = Boolean(String(carrier || "").trim());
  const hasVerifyCode = Boolean(String(verifyCode || "").trim());

  const configured = Boolean(
    process.env.EINVOICE_APP_ID &&
    process.env.EINVOICE_API_SECRET &&
    process.env.EINVOICE_API_BASE_URL
  );

  if (!configured) {
    return res.status(200).json({
      ok: true,
      mode: "DEMO_NOT_CONFIGURED",
      configured: false,
      carrierDetected: hasCarrierInput,
      verifyCodeProvided: hasVerifyCode,
      since: since || null,
      until: until || null,
      message: "財政部電子發票正式 API 尚未設定環境變數；目前只回傳待確認 Demo 發票，不會寫入帳本。",
      invoices: demoInvoices(),
    });
  }

  return res.status(200).json({
    ok: true,
    mode: "CONFIGURED_ADAPTER_PENDING",
    configured: true,
    carrierDetected: hasCarrierInput,
    verifyCodeProvided: hasVerifyCode,
    since: since || null,
    until: until || null,
    message: "環境變數已設定，但正式財政部 API adapter 尚未接上。下一步需依正式規格實作簽章、查詢與錯誤處理。",
    invoices: [],
  });
}
