// DCA Discount Hunter + Fubon DCA - Cloudflare Workers Cron Trigger
// Purpose: high-frequency free scheduler that calls both Telegram alert APIs.
// Deploy this Worker on Cloudflare and attach a Cron Trigger such as */15 * * * *.

const DEFAULT_ALERT_URLS = [
  "https://discount-hunter-sigma.vercel.app/api/telegram-alerts",
  "https://discount-hunter-sigma.vercel.app/api/fubon-telegram-alerts",
];

function configuredUrls(env) {
  if (env.ALERT_URLS) {
    return String(env.ALERT_URLS).split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (env.ALERT_URL) {
    return [env.ALERT_URL, DEFAULT_ALERT_URLS[1]];
  }
  return DEFAULT_ALERT_URLS;
}

async function callOne(alertUrl, env) {
  const secret = env.CRON_SECRET || "";
  const startedAt = new Date().toISOString();
  const response = await fetch(alertUrl, {
    method: "GET",
    headers: {
      "User-Agent": "discount-hunter-cloudflare-cron/2.0",
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

async function callAlertEndpoints(env) {
  const results = await Promise.all(configuredUrls(env).map((url) => callOne(url, env)));
  return {
    ok: results.every((item) => item.ok),
    results,
    checkedAt: new Date().toISOString(),
  };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(callAlertEndpoints(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "discount-hunter-cloudflare-cron",
        targets: configuredUrls(env),
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === "/run") {
      const result = await callAlertEndpoints(env);
      return Response.json(result, { status: result.ok ? 200 : 502 });
    }

    return Response.json({
      ok: true,
      service: "discount-hunter-cloudflare-cron",
      routes: ["/health", "/run"],
      targets: configuredUrls(env),
      scheduleSuggestion: "*/15 * * * *",
    });
  },
};
