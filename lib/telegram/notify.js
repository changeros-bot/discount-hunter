const { readAlerts, canSendAlert, markAlertSent } = require("../v16-ledger");
const { hasKvConfig, requiresDurableKv } = require("../state/kv");

async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const cooldownKey = options.cooldownKey || null;
  const cooldownHours = Number(options.cooldownHours || 12);
  const now = new Date().toISOString();

  if (cooldownKey && requiresDurableKv() && !hasKvConfig()) {
    return {
      ok: false,
      skipped: true,
      error: "missing_required_upstash_kv_for_telegram_cooldown",
      cooldownKey,
      cooldownHours,
    };
  }

  if (cooldownKey) {
    const alerts = await readAlerts();
    if (!canSendAlert(alerts, cooldownKey, now, cooldownHours)) {
      return {
        ok: true,
        skipped: true,
        deduped: true,
        cooldownKey,
        cooldownHours,
        error: null,
      };
    }
  }

  if (!token || !chatId) {
    return {
      ok: false,
      skipped: true,
      error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured",
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.description || `Telegram API error: ${res.status}`,
    };
  }

  const cooldown = cooldownKey ? await markAlertSent(cooldownKey, now) : null;
  return { ok: true, result: data.result, cooldownKey, cooldown };
}

module.exports = { sendTelegramMessage };
