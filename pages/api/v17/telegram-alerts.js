module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // 此舊路由曾與 /api/telegram-alerts 同時被排程呼叫，造成同一批通知重複送出。
  // 現在只保留相容性回應，不再轉送或發送任何 Telegram 訊息。
  return res.status(200).json({
    ok: true,
    version: "v17-telegram-alerts-v3-legacy-disabled",
    deprecated: true,
    dryRun: true,
    sent: false,
    delegated: false,
    canonicalEndpoint: "/api/telegram-alerts",
    reason: "duplicate_legacy_broadcaster_disabled",
    guardrails: {
      noTelegramSend: true,
      noStateWrite: true,
      singleNotificationEngine: true
    }
  });
};
