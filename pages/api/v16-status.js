const { hasKvConfig } = require("../../lib/state/kv");

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${host}`;

  const checks = [
    { key: "buyLedger", label: "Buy Ledger", path: "/api/buy-ledger" },
    { key: "manualBuy", label: "Manual Buy API", path: "/api/manual-buy", method: "POST", manual: true },
    { key: "todayDecisions", label: "Today Decisions", path: "/api/today-decisions", method: "POST", manual: true },
    { key: "telegramCooldown", label: "Telegram Cooldown", path: "/api/telegram-alert-check" },
    { key: "walletChangeAlerts", label: "Wallet Change Alerts", path: "/api/wallet-change-alerts" },
    { key: "dailyPositionReport", label: "Daily Position Report", path: "/api/daily-position-report" },
  ];

  const results = [];

  for (const check of checks) {
    if (check.manual) {
      results.push({ ...check, status: "manual_test_required" });
      continue;
    }

    try {
      const response = await fetch(`${base}${check.path}?t=${Date.now()}`, { cache: "no-store" });
      const body = await readJson(response);
      results.push({
        ...check,
        status: response.ok && body?.ok !== false ? "ok" : "warn",
        httpStatus: response.status,
        responseOk: body?.ok,
        reason: body?.reason || body?.error || null,
      });
    } catch (error) {
      results.push({ ...check, status: "error", error: error.message });
    }
  }

  return res.status(200).json({
    ok: true,
    version: "16.0-status",
    storage: hasKvConfig() ? "upstash_kv" : "file_fallback",
    checklist: {
      buyLedger: true,
      dcaSplitN: true,
      dipSplitD1D4: true,
      sameTier24hReset: true,
      gapDownRecord: true,
      telegramCooldown: true,
      walletChangeAlerts: true,
      dailyPositionReport: true,
      frontEndIntegrated: false,
      autoTrading: false,
    },
    results,
  });
}

module.exports = handler;
