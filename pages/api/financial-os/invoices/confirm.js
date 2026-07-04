function buildTransactionFromInvoice(invoice = {}) {
  const amount = Number(invoice.amount || 0);
  const category = invoice.suggestedCategory || invoice.category || "待分類";
  return {
    id: `txn-${invoice.id || invoice.invoiceNo || Date.now()}`,
    source: "invoice_confirm",
    sourceInvoiceId: invoice.id || null,
    invoiceNo: invoice.invoiceNo || null,
    date: invoice.date || new Date().toISOString().slice(0, 10),
    type: "支出",
    amount,
    account: invoice.account || "自用",
    category,
    isLivingExpense: invoice.isLivingExpense || "Y",
    isFixedExpense: invoice.isFixedExpense || "N",
    affectsBudget: invoice.affectsBudget || "Y",
    note: `${invoice.merchant || "載具發票"}｜發票確認入帳`,
    status: "已入帳",
    createdAt: new Date().toISOString()
  };
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const invoice = req.body?.invoice || req.body;
  if (!invoice || !invoice.id) {
    return res.status(400).json({ ok: false, message: "Missing invoice payload" });
  }

  const transaction = buildTransactionFromInvoice(invoice);

  return res.status(200).json({
    ok: true,
    message: "發票已轉成交易草稿。本版仍是 prototype，尚未寫入永久資料庫。",
    transaction
  });
}
