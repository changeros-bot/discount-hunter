const { sendTelegramMessage } = require("../../lib/telegram/notify");

const ACTION_GATE = {
  BTC: { quality: "PASSED", label: "通過", role: "Cycle Core", permission: "Discount Add Allowed", allowAction: true, reason: "BTC DCA 是獨立加密資產折價系統；需人工確認後才可執行。" },
  QQQON: { quality: "WATCH", label: "觀察", role: "ETF Mirror", permission: "Watch Only", allowAction: false, reason: "QQQ/QQQM 長期 DCA 屬富邦主系統；Market 91 不處理 ETF 核心 DCA。" },
  NVDAON: { quality: "PASSED", label: "通過", role: "AI Core / Satellite", permission: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；僅在折價觸發、現金與上限通過後允許加碼。" },
  TSMON: { quality: "PASSED", label: "通過", role: "AI Core / Satellite", permission: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；僅在折價觸發、現金與上限通過後允許加碼。" },
  AVGOON: { quality: "PASSED", label: "通過", role: "AI Core / Satellite", permission: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；僅在折價觸發、現金與上限通過後允許加碼。" },
  GOOGLON: { quality: "PASSED", label: "通過", role: "AI Core / Satellite", permission: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；僅在折價觸發、現金與上限通過後允許加碼。" },
  AMDON: { quality: "PASSED", label: "通過", role: "AI Core / Satellite", permission: "Discount Add Allowed", allowAction: true, reason: "AI Core / Satellite；資金不足時低於更高優先序標的。" },
  MRVLON: { quality: "PASSED", label: "通過", role: "Discount Buy Candidate", permission: "Discount Add Allowed", allowAction: true, reason: "Discount Buy Candidate；只在折價觸發與 thesis 沒壞時允許人工確認。" },
  RKLBON: { quality: "WATCH", label: "觀察", role: "Watch Only", permission: "Watch Only", allowAction: false, reason: "RKLBon 目前只觀察；除非重新升級，不進入今日可加碼清單。" },
  SPCXON: { quality: "PENDING", label: "新上市觀察", role: "Discount Buy Candidate", permission: "No Action", allowAction: false, reason: "SPCXon 新上市 / 歷史不足；逢低必須人工確認資料源與上市以來高點。" },
};

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  if (value === null || value === undefined) return "N/A";
  const n = num(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
function signedMoney(value) {
  if (value === null || value === undefined) return "N/A";
  const n = num(value);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function signedPct(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function twTime() {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}
function pad2(n) { return String(n).padStart(2, "0"); }
function isoDate(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function addMonth(y, m, delta) {
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
}
function taipeiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}
function budgetCycle(date = new Date(), releaseDay = 12) {
  const { y, m, d } = taipeiParts(date);
  const prev = addMonth(y, m, -1);
  const next = addMonth(y, m, 1);
  const start = d >= releaseDay ? { y, m, d: releaseDay } : { y: prev.y, m: prev.m, d: releaseDay };
  const endMonth = d >= releaseDay ? next : { y, m };
  const nextRelease = d >= releaseDay ? { y: next.y, m: next.m, d: releaseDay } : { y, m, d: releaseDay };
  return { cycleStart: isoDate(start.y, start.m, start.d), cycleEnd: isoDate(endMonth.y, endMonth.m, releaseDay - 1), nextReleaseDate: isoDate(nextRelease.y, nextRelease.m, nextRelease.d), beforeThisMonthRelease: d < releaseDay };
}
function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function symbolKey(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function gateFor(row) {
  const key = symbolKey(row?.symbol);
  return ACTION_GATE[key] || { quality: "PENDING", label: "資料待確認", role: "Unknown", permission: "No Action", allowAction: false, reason: "Action Gate 未建檔，不進入可加碼清單。" };
}
function rowAmountText(row) {
  return row?.decision?.amountText || (row?.decision?.amount ? `${row.decision.amount}U` : row?.amountText || "--");
}
function baseLineParts(row) {
  const symbol = row?.symbol || "—";
  const tier = row?.decision?.tier || row?.tier || row?.signalTier || "D?";
  const progress = Number(row?.progressPct ?? row?.progress ?? row?.decision?.progress);
  const discount = row?.discountText || row?.discount || row?.decision?.discount;
  const parts = [`${symbol}`, `${tier}`];
  if (discount !== undefined && discount !== null && discount !== "") parts.push(`回撤 ${discount}`);
  if (Number.isFinite(progress)) parts.push(`進度 ${progress.toFixed(0)}%`);
  return parts;
}
function holdingZoneLine(row) {
  return [...baseLineParts(row), "狀態：已略過本層，等待下一層"].join("｜");
}
function routeDecision(row) {
  const gate = gateFor(row);
  return { row, gate, actionable: Boolean(gate.allowAction) };
}
function decisionLine(row) {
  const gate = gateFor(row);
  return [...baseLineParts(row), `建議 ${rowAmountText(row)}`, `Bucket：${gate.role}`, `Action Gate：${gate.permission}`].join("｜");
}
function blockedLine(item) {
  return [...baseLineParts(item.row), `Bucket：${item.gate.role}`, `Action Gate：${item.gate.permission}`, `原因：${item.gate.reason}`].join("｜");
}
function readinessLines(readinessPayload) {
  if (!readinessPayload?.ok) return ["🧪 Readiness：讀取失敗或尚未同步"];
  const r = readinessPayload.readiness || {};
  const summary = readinessPayload.summary || {};
  const budget = readinessPayload.budget || {};
  const cycle = budget.cycle || budgetCycle(new Date(), 12);
  const failedChecks = (readinessPayload.checks || []).filter((x) => !x.passed).map((x) => x.name);
  const lines = [
    `🧪 Action Readiness：${r.label || r.status || "—"}`,
    `預算週期：${cycle.cycleStart}～${cycle.cycleEnd}｜下次預算日：${cycle.nextReleaseDate}`,
    `候選合計：${num(summary.totalDraftAmountUsdt).toFixed(2)}U｜候選後現金：${num(summary.cashAfterDraftsUsdt).toFixed(2)}U｜逢低預算：約 ${num(budget.dipBudgetUsdt).toFixed(2)}U`,
  ];
  if (failedChecks.length) lines.push(`需覆核：${failedChecks.join("、")}`);
  else lines.push("檢查：Bucket / 現金 / 預算 / 上限 OK");
  return lines;
}
function buildMessage(truth, sectionSummary, tradeReadiness) {
  const s = truth.summary || {};
  const cash = truth.cash || {};
  const cycle = tradeReadiness?.budget?.cycle || budgetCycle(new Date(), 12);
  const holdingRows = Array.isArray(sectionSummary?.holdingRows) ? sectionSummary.holdingRows : [];
  const decisionRows = Array.isArray(sectionSummary?.decisionRows) ? sectionSummary.decisionRows : [];
  const routed = decisionRows.map(routeDecision);
  const actionable = routed.filter((x) => x.actionable);
  const blocked = routed.filter((x) => !x.actionable);
  const lines = [
    "📊 Market 91 / xStocks 折價獵人日報",
    "",
    `時間：${twTime()}`,
    "",
    `掃描清單：${truth.monitorCount || 0} 檔`,
    `買點區持倉：${holdingRows.length} 檔`,
    `資料狀態：${s.costReady ? "正常" : `缺成本：${(s.missingSymbols || []).join("、") || "unknown"}`}`,
    "",
    `總投入：${money(s.totalCost)}`,
    `目前市值：${money(s.currentValue)}`,
    `未實現損益：${signedMoney(s.pnl)}`,
    `報酬率：${signedPct(s.pnlPct)}`,
    "",
    `現金檢查：可用 USDT ${num(cash.totalUSDT).toFixed(2)}U`,
    `Wallet USDT：${num(cash.walletUSDT).toFixed(2)}U｜Exchange USDT：${num(cash.exchangeUSDT).toFixed(2)}U`,
    `預算週期：${cycle.cycleStart}～${cycle.cycleEnd}｜下次預算日：${cycle.nextReleaseDate}`,
    `本期預算：Market 91 只使用逢低輔助預算；富邦 0050 / VOO / QQQM 主 DCA 不在本系統內`,
    "",
    "🛡 Action Gate：ON｜Auto Trade：OFF｜Manual Confirm：ON｜Kill Switch：ON",
    `Discount Add Allowed：${actionable.length} 檔｜No Action / Watch / Blocked：${blocked.length} 檔`,
    "",
    ...readinessLines(tradeReadiness),
    "",
  ];

  if (holdingRows.length > 0) {
    lines.push(`✅ 買點區持倉：${holdingRows.length} 檔`);
    holdingRows.forEach((row) => lines.push(holdingZoneLine(row)));
    lines.push("");
  } else {
    lines.push("✅ 買點區持倉：0 檔");
    lines.push("");
  }

  if (decisionRows.length > 0) {
    lines.push(`🧭 今日 Action Gate：${decisionRows.length} 檔待確認`);
    decisionRows.forEach((row) => lines.push(decisionLine(row)));
    lines.push("");
  } else {
    lines.push("🧭 今日 Action Gate：No Action");
    lines.push("Discount Add Allowed：0｜Watch Only / Blocked：0");
    lines.push("");
  }

  if (blocked.length > 0) {
    lines.push(`⛔ No Action / Watch / Blocked：${blocked.length} 檔`);
    blocked.forEach((item) => lines.push(blockedLine(item)));
    lines.push("");
  }

  lines.push("入口：/v17 ｜ /trade-readiness ｜ /v17-quality");
  lines.push("資料來源：Portfolio Truth + App 分區鏡像 + Action Gate Router + Trade Readiness");
  lines.push("Telegram 僅推播，不另行計算總投入/市值/持倉數。Market 91 只處理個股 / xStocks 逢低輔助；0050 / VOO / QQQM 屬富邦長期 DCA 主系統。實際交易仍需你手動確認。");
  return lines.join("\n").trim();
}
async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const base = baseUrlFromReq(req);
    const [truthRes, sectionRes, readinessRes] = await Promise.all([
      fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/v17/section-summary?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/v17/trade-readiness?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const truth = await readJsonSafe(truthRes);
    const sectionSummary = await readJsonSafe(sectionRes);
    const tradeReadiness = await readJsonSafe(readinessRes);
    if (!truthRes.ok || truth?.ok === false) {
      const message = ["🔴 Market 91 / xStocks 折價獵人日報失敗", "", `Portfolio Truth：${truth.message || truth.error || truthRes.status}`].join("\n");
      const shouldSendError = req.method === "POST" || String(req.query.send || "") === "1";
      const telegram = shouldSendError ? await sendTelegramMessage(message, { cooldownKey: "telegram-daily:error", cooldownHours: 12 }) : null;
      return res.status(500).json({ ok: false, sent: Boolean(telegram && !telegram.skipped), previewOnly: !shouldSendError, telegram, message });
    }
    if (!sectionRes.ok || sectionSummary?.ok === false) throw new Error(sectionSummary?.error || `section-summary ${sectionRes.status}`);

    const decisionRows = Array.isArray(sectionSummary?.decisionRows) ? sectionSummary.decisionRows : [];
    const routed = decisionRows.map(routeDecision);
    const actionableCount = routed.filter((x) => x.actionable).length;
    const blockedCount = routed.length - actionableCount;
    const message = buildMessage(truth, sectionSummary, tradeReadiness);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const force = String(req.query.force || "") === "1";
    const telegramOptions = force ? {} : { cooldownKey: "telegram-daily:daily-report", cooldownHours: 20 };
    const telegram = shouldSend ? await sendTelegramMessage(message, telegramOptions) : null;

    if (telegram && !telegram.ok) return res.status(500).json({ ok: false, telegram });

    return res.status(200).json({ ok: true, version: "telegram-daily-market91-action-gate-v17-4", sourcePolicy: "portfolio-truth-plus-app-section-mirror-plus-action-gate-plus-trade-readiness", sent: Boolean(telegram && !telegram.skipped), deduped: Boolean(telegram?.deduped), previewOnly: !shouldSend, force, holdingZoneCount: sectionSummary.holdingRows?.length || 0, decisionCount: decisionRows.length, actionableCount, blockedCount, readinessStatus: tradeReadiness?.readiness?.status || null, totals: truth.summary, cash: truth.cash, tradeReadiness, sectionSummary, monitorCount: truth.monitorCount, telegram, message });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
