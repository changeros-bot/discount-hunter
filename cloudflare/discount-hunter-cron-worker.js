// DCA Discount Hunter - Cloudflare Workers Cron Trigger
// Purpose: high-frequency free scheduler that calls the existing Vercel Telegram alert API.
// Deploy this Worker on Cloudflare and attach a Cron Trigger such as */15 * * * *.

const DEFAULT_ALERT_URL = "https://discount-hunter-sigma.vercel.app/api/telegram-alerts";

async function callAlertEndpoint(env) {
  const alertUrl = env.ALERT_URL || DEFAULT_ALERT_URL;
  const secret = env.CRON_SECRET || "";
  const startedAt = new Date().toISOString();

  const response = await fetch(alertUrl, {
    method: "GET",
    headers: {
      "User-Agent": "discount-hunter-cloudflare-cron/1.0",
      ...(secret ? { "x-cron-secret": secret } : {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }

  return {
    ok: response.ok,
    status: response.status,
    alertUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    body,
  };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(callAlertEndpoint(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "discount-hunter-cloudflare-cron", checkedAt: new Date().toISOString() });
    }

    if (url.pathname === "/run") {
      const result = await callAlertEndpoint(env);
      return Response.json(result, { status: result.ok ? 200 : 502 });
    }

    return Response.json({
      ok: true,
      service: "discount-hunter-cloudflare-cron",
      routes: ["/health", "/run"],
      scheduleSuggestion: "*/15 * * * *",
    });
  },
};
