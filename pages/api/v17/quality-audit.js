const { getQualityAudits, getQualityAudit, qualitySummary } = require("../../../lib/v17-quality-gate");

function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const symbol = req.query.symbol;
  if (symbol) {
    const audit = getQualityAudit(symbol);
    if (!audit) return res.status(404).json({ ok: false, error: "not_found" });
    return res.status(200).json({ ok: true, version: "v17-quality-audit-v1", audit });
  }
  const audits = getQualityAudits();
  return res.status(200).json({
    ok: true,
    version: "v17-quality-audit-v1",
    updatedAt: new Date().toISOString(),
    warning: "Draft data. Do not use as final auto-trading whitelist until Source Verified + Rule Checked + Approved.",
    summary: qualitySummary(),
    audits,
  });
}

module.exports = handler;
