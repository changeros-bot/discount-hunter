const { sendTelegramMessage } = require("../../../lib/telegram/notify");

function formatCard(card) {
  const lines = [
    "🚨 DCA 折價獵人 V17 今日決策",
    "",
    `${card.symbol} ${card.tier}｜${card.statusLabel || card.status}`,
    `現價：${card.price ?? "--"}`,
    `跌幅：${card.discountText || card.discount || "--"}`,
    `建議：${card.requiredText || card.amountText || "--"}`,
    `已偵測：${card.filledText || "0U"}`,
    `原因：${card.reason || "Action Queue 狀態變化"}`,
    "",
    "規則：只有狀態或價格變化才通知。"
  ];
  return lines.join("\n");
}

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
    const candidateRes = await fetch(`${protocol}://${host}/api/v17/notify-candidates?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {})
    });
    const candidateData = await readJson(candidateRes);

    if (!candidateRes.ok || candidateData?.ok === false) {
      return res.status(500).json({ ok: false, error: candidateData?.error || `notify_candidates_http_${candidateRes.status}` });
    }

    const candidates = candidateData.candidates || [];
    const messages = candidates.map(formatCard);
    const results = [];

    if (shouldSend) {
      for (const message of messages) {
        const sent = await sendTelegramMessage(message);
        results.push(sent);
        if (!sent.ok) return res.status(500).json({ ok: false, sent: false, failed: sent, sentCount: results.length, candidates });
      }
    }

    return res.status(200).json({
      ok: true,
      version: "v17-telegram-alerts-v1",
      dryRun: !shouldSend,
      sent: shouldSend && results.length > 0,
      candidateCount: candidates.length,
      sentCount: shouldSend ? results.length : 0,
      candidates,
      messages,
      telegramResults: results,
      guardrails: {
        defaultDryRun: true,
        requiresPostSendTrue: true,
        source: "v17_notify_candidates_only"
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_telegram_alert_failed" });
  }
};
