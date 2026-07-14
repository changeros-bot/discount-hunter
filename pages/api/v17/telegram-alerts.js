async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const shouldSend = req.method === "POST" && req.body?.send === true;

    // 舊的 V17 排程仍會每 5 分鐘呼叫這個路由。
    // 不再自行把 notify-candidates 的每次價格變化都發出去，
    // 改由唯一的 layer-change-only 引擎判斷：
    // 已買入且層級未變 → 不通知；只有 D 層級上下改變才通知。
    const target = `${protocol}://${host}/api/telegram-alerts?t=${Date.now()}`;

    if (!shouldSend) {
      return res.status(200).json({
        ok: true,
        version: "v17-telegram-alerts-v2-delegated",
        dryRun: true,
        sent: false,
        repeatMode: "layer_change_only",
        purchaseDetection: "ledger_or_live_total_cost",
        delegatedTo: "/api/telegram-alerts",
        guardrails: {
          defaultDryRun: true,
          requiresPostSendTrue: true,
          legacyCandidateBroadcasterDisabled: true
        }
      });
    }

    const delegatedRes = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "v17-legacy-scheduler" }),
      cache: "no-store"
    });
    const delegated = await readJson(delegatedRes);

    if (!delegatedRes.ok || delegated?.ok === false) {
      return res.status(500).json({
        ok: false,
        error: delegated?.error || `telegram_alerts_http_${delegatedRes.status}`,
        delegated
      });
    }

    return res.status(200).json({
      ok: true,
      version: "v17-telegram-alerts-v2-delegated",
      dryRun: false,
      sent: Boolean(delegated?.sent),
      sentCount: Number(delegated?.sendableCount || 0),
      repeatMode: "layer_change_only",
      purchaseDetection: delegated?.purchaseDetection || "ledger_or_live_total_cost",
      delegatedTo: "/api/telegram-alerts",
      delegated
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_telegram_alert_failed" });
  }
};
