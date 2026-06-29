async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function pass(name, extra = {}) {
  return { name, status: "PASS", ...extra };
}

function fail(name, reason, extra = {}) {
  return { name, status: "FAIL", reason, ...extra };
}

async function callJson(base, path, options = {}) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${base}${path}${separator}t=${Date.now()}`, {
    cache: "no-store",
    ...options,
  });
  const body = await readJson(response);
  return { response, body };
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${host}`;
  const results = [];

  let prices = null;
  let ledger = null;

  try {
    const pricesCall = await callJson(base, "/api/prices");
    prices = pricesCall.body;
    if (pricesCall.response.ok && prices?.ok !== false && nonEmptyArray(prices?.data)) {
      results.push(pass("prices", { count: prices.data.length }));
    } else {
      results.push(fail("prices", "prices_unhealthy", { httpStatus: pricesCall.response.status, ok: prices?.ok ?? null }));
    }
  } catch (error) {
    results.push(fail("prices", error.message || "prices_exception"));
  }

  try {
    const ledgerCall = await callJson(base, "/api/buy-ledger");
    ledger = ledgerCall.body?.ledger || null;
    const ledgerObject = ledger && typeof ledger === "object" && !Array.isArray(ledger);
    if (ledgerCall.response.ok && ledgerCall.body?.ok !== false && ledgerObject) {
      results.push(pass("buy-ledger", { symbols: Object.keys(ledger).length }));
    } else {
      results.push(fail("buy-ledger", "ledger_unhealthy", { httpStatus: ledgerCall.response.status, ok: ledgerCall.body?.ok ?? null }));
    }
  } catch (error) {
    results.push(fail("buy-ledger", error.message || "ledger_exception"));
  }

  try {
    if (!nonEmptyArray(prices?.data) || !ledger) throw new Error("missing_prices_or_ledger");
    const decisionCall = await callJson(base, "/api/today-decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: prices.data, ledger }),
    });
    const decisions = decisionCall.body?.decisions || [];
    const keys = decisions.map((d) => `${String(d.symbol || "").toUpperCase()}:${String(d.tier || "").toUpperCase()}`);
    const duplicateCount = keys.length - new Set(keys).size;
    if (decisionCall.response.ok && decisionCall.body?.ok !== false && Array.isArray(decisions) && duplicateCount === 0) {
      results.push(pass("today-decisions-post", { decisions: decisions.length, duplicateCount }));
    } else {
      results.push(fail("today-decisions-post", "decisions_unhealthy", { httpStatus: decisionCall.response.status, duplicateCount }));
    }
  } catch (error) {
    results.push(fail("today-decisions-post", error.message || "decisions_exception"));
  }

  try {
    const telegramCall = await callJson(base, "/api/telegram-alerts");
    const telegram = telegramCall.body;
    if (telegramCall.response.ok && telegram?.ok === true && telegram?.walletOk !== false && telegram?.pricesOk !== false) {
      results.push(pass("telegram-alerts", { version: telegram.version || null, eventCount: telegram.eventCount ?? null, sendableCount: telegram.sendableCount ?? null }));
    } else {
      results.push(fail("telegram-alerts", "telegram_alerts_unhealthy", { httpStatus: telegramCall.response.status, ok: telegram?.ok ?? null, walletOk: telegram?.walletOk ?? null, pricesOk: telegram?.pricesOk ?? null, error: telegram?.error || null }));
    }
  } catch (error) {
    results.push(fail("telegram-alerts", error.message || "telegram_exception"));
  }

  const failed = results.filter((item) => item.status !== "PASS");

  return res.status(200).json({
    ok: failed.length === 0,
    version: "v16-regression-1",
    checkedAt: new Date().toISOString(),
    base,
    passCount: results.length - failed.length,
    failCount: failed.length,
    results,
  });
}

module.exports = handler;
