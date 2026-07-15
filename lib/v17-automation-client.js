export const V17_AUTOMATION_TOKEN_SESSION_KEY = "v17AutomationSessionToken";

export function readAutomationSessionToken() {
  if (typeof window === "undefined") return "";
  return String(window.sessionStorage.getItem(V17_AUTOMATION_TOKEN_SESSION_KEY) || "");
}

export function saveAutomationSessionToken(value) {
  if (typeof window === "undefined") return "";
  const token = String(value || "").trim();
  if (token) window.sessionStorage.setItem(V17_AUTOMATION_TOKEN_SESSION_KEY, token);
  else window.sessionStorage.removeItem(V17_AUTOMATION_TOKEN_SESSION_KEY);
  return token;
}

export function automationAuthHeaders(extra = {}) {
  const token = readAutomationSessionToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
