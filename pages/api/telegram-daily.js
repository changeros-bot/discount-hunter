const { sendTelegramMessage } = require("../../lib/telegram/notify");

const QUALITY_GATE = {
  BTC: { quality: "PASSED", label: "通過", role: "Cycle Core", permission: "可草稿", allowDraft: true, reason: "週期核心；人工確認後可草稿。" },
  QQQON: { quality: "PASSED", label: "通過", role: "ETF Core", permission: "可草稿", allowDraft: true, reason: "ETF 核心；人工確認後可草稿。" },
  NVDAON: { quality: "PASSED", label: "通過", role: "Core", permission: "可草稿", allowDraft: true, reason: "核心 AI 標的；人工確認後可草稿。" },
  TSMON: { quality: "PASSED", label: "通過", role: "Core", permission: "可草稿", allowDraft: true, reason: "核心半導體標的；人工確認後可草稿。" },
  AVGOON: { quality: "PASSED", label: "通過", role: "Core", permission: "可草稿", allowDraft: true, reason: "核心 AI 基礎建設；人工確認後可草稿。" },
  GOOGLON: { quality: "PASSED", label: "通過", role: "Core", permission: "可草稿", allowDraft: true, reason: "核心平台型標的；人工確認後可草稿。" },
  AMDON: { quality: "PASSED", label: "通過", role: "Satellite", permission: "低優先草稿", allowDraft: true, reason: "Quality 通過，但仍是衛星標的；資金不足時低於核心。" },
  MRVLON: { quality: "PASSED", label: "通過", role: "Satellite", permission: "低優先草稿", allowDraft: true, reason: "Quality 通過，但仍是衛星標的；資金不足時低於核心。" },
  RKLBON: { quality: "WATCH", label: "觀察", role: "Spec Watch", permission: "只深跌人工確認", allowDraft: true, reason: "RKLBon 不固定 DCA；只允許 -50/-65/-80 深折扣低優先人工草稿。" },
  SPCXON: { quality: "PENDING", label: "新上市觀察", role: "Data Pending", permission: "人工確認", allowDraft: false, reason: "SPCXon 新上市 / 歷史不足；逢低必須人工確認資料源與上市以來高點。" },
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
  return QUALITY_GATE[key] || { quality: "PENDING", label: "資料待確認", role: "Unknown", permission: "禁止", allowDraft: false, reason: "Quality Gate 未建檔，不產生草稿。" };
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
  return { row, gate, draftable: Boolean(gate.allowDraft) };
}
function decisionLine(row) {
  const gate = gateFor(row);
  const action = gate.allowDraft ? `半自動：${gate.permission}` : "半自動：不產生草稿";
  return [...baseLineParts(row), `建議 ${rowAmountText(row)}`, `Quality：${gate.label}`, action].join("｜");
}
function blockedLine(item) {
  return [...baseLineParts(item.row), `Quality：${item.gate.label}`, `原因：${item.gate.reason}`].join("｜");
}
function readinessLines(readinessPayload) {
  if (!readinessPayload?.ok) return ["🧪 Trade Readiness：讀取失敗或尚未同步"];
  const r = readinessPayload.readiness || {};
  const summary = readinessPayload.summary || {};
  const budget = readinessPayload.budget || {};
  const cycle = budget.cycle || budgetCycle(new Date(), 12);
  const failedChecks = (readinessPayload.checks || []).filter((x) => !x.passed).map((x) => x.name);
  const lines = [
    `🧪 Trade Readiness：${r.label || r.status || "—"}`,
    `預算週期：${cycle.cycleStart}～${cycle.cycleEnd}｜下次預算日：${cycle.nextReleaseDate}`,
    `草稿合計：${num(summary.totalDraftAmountUsdt).toFixed(2)}U｜草稿後現金：${num(summary.cashAfterDraftsUsdt).toFixed(2)}U｜逢低預算：約 ${num(budget.dipBudgetUsdt).toFixed(2)}U`,
  ];
  if (failedChecks.length) lines.push(`需覆核：${failedChecks.join("、")}`);
  else lines.push("檢查：Quality / 現金 / 預算 / 上限 OK");
  return lines;
}
function buildMessage(truth, sectionSummary, tradeReadiness) {
  const s = truth.summary || {};
  const cash = truth.cash || {};
  const cycle = tradeReadiness?.budget?.cycle || budgetCycle(new Date(), 12);
  const holdingRows = Array.isArray(sectionSummary?.holdingRows) ? sectionSummary.holdingRows : [];
  const decisionRows = Array.isArray(sectionSummary?.decisionRows) ? sectionSummary.decisionRows : [];
  const routed = decisionRows.map(routeDecision);
  const draftable = routed.filter((x) => x.draftable);
  const blocked = routed.filter((x) => !x.draftable);
  const lines = [
    "📊 DCA折價獵人日報",
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
    `本期預算：3000 TWD｜固定DCA 1500｜逢低 1500`,
    "",
    "🛡 Quality Gate：ON｜Auto Trade：OFF｜Manual Confirm：ON｜Kill Switch：ON",
    `半自動草稿候選：${draftable.length} 檔｜被擋下：${blocked.length} 檔`,
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
    lines.push(`🧭 今日決策：${decisionRows.length} 檔待確認`);
    decisionRows.forEach((row) => lines.push(decisionLine(row)));
    lines.push("");
  } else {
    lines.push("🧭 今日決策：目前無可執行買點");
    lines.push("半自動草稿：0｜被 Quality Gate 擋下：0");
    lines.push("");
  }

  if (blocked.length > 0) {
    lines.push(`⛔ Quality Gate 擋下：${blocked.length} 檔`);
    blocked.forEach((item) => lines.push(blockedLine(item)));
    lines.push("");
  }

  lines.push("入口：/v17 ｜ /semi-auto-drafts ｜ /trade-readiness ｜ /v17-quality");
  lines.push("資料來源：Portfolio Truth + App 分區鏡像 + Quality Gate Router + Trade Readiness");
  lines.push("Telegram 僅推播，不另行計算總投入/市值/持倉數。觀察區不列入買點區持倉。Draft 不代表自動交易白名單。每月新預算 12 號才入金。實際交易仍需你手動確認。");
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
      const message = ["🔴 DCA折價獵人日報失敗", "", `Portfolio Truth：${truth.message || truth.error || truthRes.status}`].join("\n");
      const shouldSendError = req.method === "POST" || String(req.query.send || "") === "1";
      const telegram = shouldSendError ? await sendTelegramMessage(message, { cooldownKey: "telegram-daily:error", cooldownHours: 12 }) : null;
      return res.status(500).json({ ok: false, sent: Boolean(telegram && !telegram.skipped), previewOnly: !shouldSendError, telegram, message });
    }
    if (!sectionRes.ok || sectionSummary?.ok === false) throw new Error(sectionSummary?.error || `section-summary ${sectionRes.status}`);

    const decisionRows = Array.isArray(sectionSummary?.decisionRows) ? sectionSummary.decisionRows : [];
    const routed = decisionRows.map(routeDecision);
    const draftableCount = routed.filter((x) => x.draftable).length;
    const blockedCount = routed.length - draftableCount;
    const message = buildMessage(truth, sectionSummary, tradeReadiness);
    const shouldSend = req.method === "POST" || String(req.query.send || "") === "1";
    const force = String(req.query.force || "") === "1";
    const telegramOptions = force ? {} : { cooldownKey: "telegram-daily:daily-report", cooldownHours: 20 };
    const telegram = shouldSend ? await sendTelegramMessage(message, telegramOptions) : null;

    if (telegram && !telegram.ok) return res.status(500).json({ ok: false, telegram });

    return res.status(200).json({ ok: true, version: "telegram-daily-trade-readiness-v6", sourcePolicy: "portfolio-truth-plus-app-section-mirror-plus-quality-gate-plus-trade-readiness", sent: Boolean(telegram && !telegram.skipped), deduped: Boolean(telegram?.deduped), previewOnly: !shouldSend, force, holdingZoneCount: sectionSummary.holdingRows?.length || 0, decisionCount: decisionRows.length, draftableCount, blockedCount, readinessStatus: tradeReadiness?.readiness?.status || null, totals: truth.summary, cash: truth.cash, tradeReadiness, sectionSummary, monitorCount: truth.monitorCount, telegram, message });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Daily summary failed" });
  }
}

module.exports = handler;
