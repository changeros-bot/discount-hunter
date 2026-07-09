function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function round2(value) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}
function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount,
  }]));
}
function check(name, passed, detail, severity = "blocker") {
  return { name, passed: Boolean(passed), detail, severity };
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
  const currentMonth = { y, m };
  const prev = addMonth(y, m, -1);
  const next = addMonth(y, m, 1);
  const start = d >= releaseDay ? { y, m, d: releaseDay } : { y: prev.y, m: prev.m, d: releaseDay };
  const endMonth = d >= releaseDay ? next : currentMonth;
  const nextRelease = d >= releaseDay ? { y: next.y, m: next.m, d: releaseDay } : { y, m, d: releaseDay };
  return {
    releaseDay,
    todayTaipei: isoDate(y, m, d),
    cycleStart: isoDate(start.y, start.m, start.d),
    cycleEnd: isoDate(endMonth.y, endMonth.m, releaseDay - 1),
    nextReleaseDate: isoDate(nextRelease.y, nextRelease.m, nextRelease.d),
    newMonthlyBudgetAvailableToday: d === releaseDay,
    beforeThisMonthRelease: d < releaseDay,
    note: d < releaseDay ? `本月新預算尚未入金，下一次預算日 ${isoDate(nextRelease.y, nextRelease.m, nextRelease.d)}。目前仍屬上一期預算週期。` : `本期預算已於 ${isoDate(start.y, start.m, start.d)} 開始，下一次預算日 ${isoDate(nextRelease.y, nextRelease.m, nextRelease.d)}。`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const base = baseUrlFromReq(req);
    const now = new Date().toISOString();
    const fxTwdPerUsdt = num(req.query.fx || process.env.V17_TWD_PER_USDT || 32.5, 32.5);
    const cycle = budgetCycle(new Date(), 12);
    const budget = {
      currency: "TWD normalized to USDT",
      fxTwdPerUsdt,
      releaseDay: 12,
      cycle,
      monthlyBudgetTwd: 3000,
      fubonMainDcaTwd: 1500,
      market91DipBudgetTwd: 1500,
      monthlyBudgetUsdt: round2(3000 / fxTwdPerUsdt),
      fubonMainDcaBudgetUsdt: round2(1500 / fxTwdPerUsdt),
      market91DipBudgetUsdt: round2(1500 / fxTwdPerUsdt),
      dailyActionCapUsdt: 30,
      singleActionCapUsdt: 30,
      minimumCashReserveUsdt: 5,
      note: "富邦 0050 / VOO / QQQM 是主 DCA 系統；Market 91 只檢查個股 / xStocks 逢低輔助預算。FX is configurable with ?fx=.",
    };

    const [pricesRes, truthRes] = await Promise.all([
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const prices = await readJsonSafe(pricesRes);
    const truth = await readJsonSafe(truthRes);
    if (!pricesRes.ok || prices?.ok === false) throw new Error(prices?.error || `prices ${pricesRes.status}`);
    if (!truthRes.ok || truth?.ok === false) throw new Error(truth?.error || `portfolio-truth ${truthRes.status}`);

    const rows = Array.isArray(prices.data) ? prices.data : [];
    const markets = marketMapFromRows(rows);
    const gateRes = await fetch(`${base}/api/v17/semi-auto-drafts?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markets }),
    });
    const gatePayload = await readJsonSafe(gateRes);
    if (!gateRes.ok || gatePayload?.ok === false) throw new Error(gatePayload?.error || `action-gate ${gateRes.status}`);

    const cash = truth.cash || {};
    const totalCashUsdt = num(cash.totalUSDT);
    const candidates = Array.isArray(gatePayload.discountAddAllowed) ? gatePayload.discountAddAllowed : [];
    const noAction = Array.isArray(gatePayload.noAction) ? gatePayload.noAction : [];
    const totalCandidateAmountUsdt = round2(candidates.reduce((s, d) => s + num(d.amountUsd), 0));
    const maxSingleAction = candidates.reduce((m, d) => Math.max(m, num(d.amountUsd)), 0);

    const checks = [
      check("Budget Cycle", true, `預算日 12 號｜本期 ${cycle.cycleStart} 至 ${cycle.cycleEnd}｜下一次 ${cycle.nextReleaseDate}.`),
      check("Action Gate", gatePayload.safety?.createsDrafts === false && gatePayload.safety?.whitelist === false, "Action Gate must not create drafts or whitelist entries."),
      check("Auto Trade OFF", gatePayload.safety?.autoTrade === false, "This stage is readiness-only; no order API is allowed."),
      check("Manual Confirm ON", gatePayload.safety?.requiresManualConfirmation === true, "User must manually confirm any real action outside the app."),
      check("Cash Enough", totalCashUsdt >= totalCandidateAmountUsdt, `Cash ${totalCashUsdt.toFixed(2)}U vs candidate ${totalCandidateAmountUsdt.toFixed(2)}U.`),
      check("Cash Reserve", totalCashUsdt - totalCandidateAmountUsdt >= budget.minimumCashReserveUsdt || totalCandidateAmountUsdt === 0, `Keep at least ${budget.minimumCashReserveUsdt}U after candidates.`),
      check("Current Cycle Market 91 Dip Budget", totalCandidateAmountUsdt <= budget.market91DipBudgetUsdt, `本期 Market 91 逢低預算 ${budget.market91DipBudgetUsdt.toFixed(2)}U vs candidate ${totalCandidateAmountUsdt.toFixed(2)}U.`),
      check("Daily Action Cap", totalCandidateAmountUsdt <= budget.dailyActionCapUsdt, `Daily cap ${budget.dailyActionCapUsdt.toFixed(2)}U.`),
      check("Single Action Cap", maxSingleAction <= budget.singleActionCapUsdt, `Single action max ${budget.singleActionCapUsdt.toFixed(2)}U.`),
    ];
    const blockers = checks.filter((x) => !x.passed && x.severity === "blocker");
    const readiness = totalCandidateAmountUsdt === 0
      ? { status: "READY_IDLE", label: "目前無可加碼候選", canShowCandidates: false, canManualConfirm: false, reason: `No Discount Add Allowed candidate today. ${cycle.note}` }
      : blockers.length === 0
        ? { status: "READY_FOR_MANUAL_CONFIRMATION", label: "可人工確認", canShowCandidates: true, canManualConfirm: true, reason: `Action Gate, cash, cycle budget and safety checks passed for manual confirmation. ${cycle.note}` }
        : { status: "NEEDS_MANUAL_REVIEW", label: "需人工覆核", canShowCandidates: true, canManualConfirm: false, reason: blockers.map((x) => x.name).join(" / ") };

    return res.status(200).json({
      ok: true,
      version: "v17-4-market91-action-readiness-v1",
      updatedAt: now,
      mode: "market91_action_readiness_no_drafts_no_order_execution",
      autoTradingEnabled: false,
      createsDrafts: false,
      whitelistEnabled: false,
      killSwitch: true,
      cash: {
        totalUSDT: round2(totalCashUsdt),
        walletUSDT: round2(num(cash.walletUSDT)),
        exchangeUSDT: round2(num(cash.exchangeUSDT)),
      },
      budget,
      summary: {
        candidateCount: candidates.length,
        noActionCount: noAction.length,
        totalCandidateAmountUsdt,
        maxSingleActionUsdt: round2(maxSingleAction),
        cashAfterCandidatesUsdt: round2(totalCashUsdt - totalCandidateAmountUsdt),
        draftCount: 0,
        blockedCount: noAction.length,
        totalDraftAmountUsdt: 0,
        cashAfterDraftsUsdt: round2(totalCashUsdt),
      },
      readiness,
      checks,
      candidates,
      noAction,
      drafts: [],
      blocked: noAction,
      source: {
        prices: "/api/prices",
        portfolioTruth: "/api/v17/portfolio-truth",
        actionGateCompat: "/api/v17/semi-auto-drafts",
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "trade_readiness_failed" });
  }
}
