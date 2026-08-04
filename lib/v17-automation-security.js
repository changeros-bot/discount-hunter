import crypto from "crypto";

export const AUTOMATION_TOKEN_ENV = "V17_AUTOMATION_API_TOKEN";
export const KILL_SWITCH_ENV = "V17_AUTOMATION_KILL_SWITCH";

function clean(value) {
  return String(value || "").trim();
}

function bearerToken(req) {
  const header = clean(req?.headers?.authorization);
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return clean(req?.headers?.["x-v17-automation-token"]);
}

function safeEqual(left, right) {
  const a = Buffer.from(clean(left));
  const b = Buffer.from(clean(right));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getAutomationSecurityStatus() {
  const tokenConfigured = Boolean(clean(process.env[AUTOMATION_TOKEN_ENV]));
  const killSwitchActive = clean(process.env[KILL_SWITCH_ENV]).toUpperCase() !== "OFF";
  return {
    version: "v17.7-secure-semi-auto",
    tokenConfigured,
    killSwitchActive,
    failClosed: true,
    writeAuthRequired: true,
    realOrdersEnabled: false,
  };
}

export function requireAutomationWriteAuth(req) {
  const expected = clean(process.env[AUTOMATION_TOKEN_ENV]);
  if (!expected) {
    const error = new Error("automation_auth_not_configured");
    error.statusCode = 503;
    throw error;
  }
  if (!safeEqual(bearerToken(req), expected)) {
    const error = new Error("automation_auth_failed");
    error.statusCode = 401;
    throw error;
  }
  return { authenticated: true, actor: "v17_authenticated_user" };
}

export function assertKillSwitchAllowsDryRun() {
  const active = clean(process.env[KILL_SWITCH_ENV]).toUpperCase() !== "OFF";
  if (active) {
    const error = new Error("automation_kill_switch_active");
    error.statusCode = 423;
    throw error;
  }
  return { killSwitchActive: false };
}

export function automationErrorStatus(error, fallback = 400) {
  const status = Number(error?.statusCode || fallback);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}
