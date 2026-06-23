function hasKvConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command) {
  if (!hasKvConfig()) {
    return { ok: false, missingConfig: true, result: null };
  }

  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Upstash error ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { ok: true, missingConfig: false, result: data?.result ?? null };
}

async function getJson(key) {
  const response = await upstash(["GET", key]);
  if (!response.ok) return response;
  if (!response.result) return { ...response, result: null };

  try {
    return { ...response, result: JSON.parse(response.result) };
  } catch {
    return { ...response, result: null, parseError: true };
  }
}

async function setJson(key, value) {
  return upstash(["SET", key, JSON.stringify(value)]);
}

module.exports = {
  hasKvConfig,
  getJson,
  setJson,
};
