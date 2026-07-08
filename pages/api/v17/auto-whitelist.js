const { getQualityAudits } = require("../../../lib/v17-quality-gate");

function evaluate(audit) {
  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
  add("Quality Passed", audit.quality === "PASSED", `目前：${audit.qualityLabel || audit.quality}`);
  add("Pipeline Approved", audit.pipeline === "Approved", `目前：${audit.pipeline || "—"}`);
  add("Core Role", ["Core", "ETF Core", "Cycle Core"].includes(audit.role), `目前角色：${audit.role}`);
  add("No Major Fails", !audit.majorFails?.length, audit.majorFails?.length ? audit.majorFails.join("；") : "無重大失敗項");
  add("Whitelist Permission", audit.permissions?.whitelistCandidate === true, `目前：${audit.permissions?.whitelistCandidate ? "候選" : "否"}`);
  add("Two Quarterly Passes", false, "尚未建立連續兩次季度通過紀錄");
  add("Kill Switch Compatible", true, "必須保持 kill switch 與每日/單筆上限");
  const blockers = checks.filter((x) => !x.passed);
  const precheckStatus = blockers.length === 0 ? "ELIGIBLE" : audit.quality === "PASSED" && ["Core", "ETF Core", "Cycle Core"].includes(audit.role) ? "NOT_YET" : "EXCLUDED";
  let reason = "";
  if (precheckStatus === "ELIGIBLE") reason = "理論上可列入有限自動交易白名單，但仍不代表啟用真實下單。";
  else if (precheckStatus === "NOT_YET") reason = "Quality 與角色大致符合，但尚未 Approved 或缺連續季度紀錄。";
  else reason = "不符合白名單前置條件。";
  return { symbol: audit.symbol, underlying: audit.underlying, role: audit.role, quality: audit.quality, qualityLabel: audit.qualityLabel, pipeline: audit.pipeline, score: audit.totalScore, precheckStatus, reason, checks };
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const rows = getQualityAudits().map(evaluate);
    const summary = rows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.precheckStatus] = (acc[row.precheckStatus] || 0) + 1;
      return acc;
    }, { total: 0, ELIGIBLE: 0, NOT_YET: 0, EXCLUDED: 0 });
    return res.status(200).json({
      ok: true,
      version: "v17-auto-whitelist-precheck-v1",
      updatedAt: new Date().toISOString(),
      mode: "precheck_only_no_order_execution",
      autoTradingEnabled: false,
      killSwitchRequired: true,
      rules: [
        "Quality 必須通過",
        "Pipeline 必須 Approved，Draft 不可進白名單",
        "角色必須是 Core / ETF Core / Cycle Core",
        "不得有重大失敗項",
        "必須連續兩次季度稽核通過",
        "仍須單筆、單日、月預算、kill switch 限制",
      ],
      summary,
      rows,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "auto_whitelist_failed" });
  }
}
