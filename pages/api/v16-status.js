const { hasKvConfig, requiresDurableKv, getStorageMode } = require("../../lib/state/kv");
const { isPricesHealthy, isWalletHealthy, healthSummary } = require("../../lib/v16-health");

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

function resultStatus(response, body) {
  return response.ok && body?.ok !== false ? "ok" : "error";
}

async function callJson(base, check, payload = null) {
  const response = await fetch(`${base}${check.path}?t=${Date.now()}`, {
    cache: "no-store",
    method: check.method || "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await readJson(response);
  return {
    ...check,
    status: resultStatus(response, body),
    httpStatus: response.status,
    responseOk: body?.ok,
    reason: body?.reason || body?.error || null,
    body,
  };
}

function summarizeResult(result) {
  const summary = { ...result };
  delete summary.body;
  return summary;
}

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${host}`;
  const storage = getStorageMode();
  const durableStateOk = hasKvConfig() || !requiresDurableKv();

  const results = [{
    key: "durableState",
    label: "Production Durable State",
    critical: true,
    status: durableStateOk ? "ok" : "error",
    storage,
    requiresDurableKv: requiresDurableKv(),
    hasKvConfig: hasKvConfig(),
    reason: durableStateOk ? null : "missing_required_upstash_kv",
  }];

  let pricesResult = null;
  let walletResult = null;
  let health = null;

  try {
    const rawPricesResult = await callJson(base, { key: "prices", label: "Prices", path: "/api/prices", critical: true });
    const pricesOk = isPricesHealthy(rawPricesResult.body);
    pricesResult = {
      ...rawPricesResult,
      status: rawPricesResult.httpStatus >= 200 && rawPricesResult.httpStatus < 300 && pricesOk ? "ok" : "error",
      reason: pricesOk ? null : "prices_unhealthy_payload",
    };
    results.push(summarizeResult({
      ...pricesResult,
      dataCount: Array.isArray(rawPricesResult.body?.data) ? rawPricesResult.body.data.length : 0,
    }));
  } catch (error) {
    results.push({ key: "prices", label: "Prices", path: "/api/prices", critical: true, status: "error", error: error.message });
  }

  try {
    const rawWalletResult = await callJson(base, { key: "syncWallet", label: "Sync Wallet", path: "/api/sync-wallet", method: "POST", critical: true }, {});
    const walletOk = isWalletHealthy(rawWalletResult.body);
    walletResult = {
      ...rawWalletResult,
      status: rawWalletResult.httpStatus >= 200 && rawWalletResult.httpStatus < 300 && walletOk ? "ok" : "error",
      reason: walletOk ? null : "wallet_unhealthy_payload",
    };
    results.push(summarizeResult({
      ...walletResult,
      holdingsCount: Array.isArray(rawWalletResult.body?.holdings) ? rawWalletResult.body.holdings.length : 0,
      liveBalanceHoldingsCount: Number(rawWalletResult.body?.debugCounts?.liveBalanceHoldingsCount || 0),
      selectedLiveBalanceHoldingsCount: Number(rawWalletResult.body?.debugCounts?.selectedLiveBalanceHoldingsCount || 0),
    }));
  } catch (error) {
    results.push({ key: "syncWallet", label: "Sync Wallet", path: "/api/sync-wallet", method: "POST", critical: true, status: "error", error: error.message });
  }

  health = healthSummary({ prices: pricesResult?.body, wallet: walletResult?.body });

  if (pricesResult?.status === "ok" && walletResult?.status === "ok") {
    try {
      const reconcileResult = await callJson(
        base,
        { key: "reconcileTiersDryRun", label: "Reconcile Tiers Dry Run", path: "/api/reconcile-tiers", method: "POST", critical: true },
        { assets: pricesResult.body?.data || [], holdings: walletResult.body?.holdings || [], dryRun: true }
      );
      results.push(summarizeResult({
        ...reconcileResult,
        dryRun: reconcileResult.body?.dryRun,
        addedCount: reconcileResult.body?.addedCount,
        storage: reconcileResult.body?.storage,
      }));
    } catch (error) {
      results.push({ key: "reconcileTiersDryRun", label: "Reconcile Tiers Dry Run", path: "/api/reconcile-tiers", method: "POST", critical: true, status: "error", error: error.message });
    }
  } else {
    results.push({
      key: "reconcileTiersDryRun",
      label: "Reconcile Tiers Dry Run",
      path: "/api/reconcile-tiers",
      method: "POST",
      critical: true,
      status: "blocked",
      reason: "prices_or_wallet_not_ok",
    });
  }

  const passiveChecks = [
    { key: "buyLedger", label: "Buy Ledger", path: "/api/buy-ledger" },
    { key: "telegramCooldown", label: "Telegram Cooldown", path: "/api/telegram-alert-check" },
    { key: "dailyPositionReport", label: "Daily Position Report", path: "/api/daily-position-report" },
  ];

  for (const check of passiveChecks) {
    try {
      const result = await callJson(base, check);
      results.push(summarizeResult(result));
    } catch (error) {
      results.push({ ...check, status: "error", error: error.message });
    }
  }

  results.push(
    { key: "manualBuy", label: "Manual Buy API", path: "/api/manual-buy", method: "POST", status: "manual_test_required" },
    { key: "todayDecisions", label: "Today Decisions", path: "/api/today-decisions", method: "POST", status: "manual_test_required" },
    { key: "walletChangeAlerts", label: "Wallet Change Alerts", path: "/api/wallet-change-alerts", status: "manual_test_required", reason: "state_writing_endpoint_not_used_by_health_check" },
    { key: "telegramTransport", label: "Telegram Transport", path: "/api/telegram-test", method: "POST", status: "manual_test_required", reason: "avoid_forced_spam_send" }
  );

  const failedCritical = results.filter((item) => item.critical && item.status !== "ok");
  const releaseBlocked = failedCritical.length > 0;

  return res.status(200).json({
    ok: !releaseBlocked,
    version: "16.6-shared-health-gate",
    storage,
    durableStateOk,
    requiresDurableKv: requiresDurableKv(),
    hasKvConfig: hasKvConfig(),
    pricesOk: Boolean(health?.pricesOk),
    walletOk: Boolean(health?.walletOk),
    health,
    releaseBlocked,
    releaseBlockers: failedCritical.map((item) => ({ key: item.key, reason: item.reason || item.error || item.status })),
    checklist: {
      buyLedger: true,
      pricesHealthGate: "shared_v16_health",
      walletHealthGate: "shared_v16_health",
      reconcileDryRunHealthGate: true,
      durableStateGate: true,
      dcaSplitN: true,
      dipSplitD1D4: true,
      sameTier24hReset: true,
      gapDownRecord: true,
      telegramCooldown: true,
      walletChangeAlerts: "manual_only",
      dailyPositionReport: true,
      frontEndIntegrated: true,
      progress100MeansTrigger: true,
      autoTrading: false,
    },
    results,
  });
}

module.exports = handler;
