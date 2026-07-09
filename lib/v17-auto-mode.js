import { nowIso, readV17AutoStore, writeV17AutoStore } from "./v17-auto-store";

export const AUTO_MODES = ["OFF", "WATCH", "DRAFT", "DRY_RUN", "SEMI_AUTO", "AUTO"];
export const WRITABLE_AUTO_MODES_V1 = ["OFF", "WATCH", "DRAFT", "DRY_RUN"];

export const DEFAULT_AUTO_MODE = {
  mode: "DRY_RUN",
  updatedAt: "2026-07-09T18:30:00+08:00",
  updatedBy: "system",
  note: "V17.6 dry-run only. No real Binance order is allowed.",
};

export function normalizeAutoMode(mode) {
  const value = String(mode || "").trim().toUpperCase().replace(/-/g, "_");
  if (!AUTO_MODES.includes(value)) throw new Error(`invalid_auto_mode:${mode}`);
  return value;
}

export async function readAutoMode() {
  const data = await readV17AutoStore({ name: "autoMode", fallback: DEFAULT_AUTO_MODE });
  try {
    return { ...DEFAULT_AUTO_MODE, ...data, mode: normalizeAutoMode(data?.mode || DEFAULT_AUTO_MODE.mode) };
  } catch {
    return DEFAULT_AUTO_MODE;
  }
}

export async function setAutoMode({ mode, updatedBy = "user", note = "" }) {
  const normalized = normalizeAutoMode(mode);
  if (!WRITABLE_AUTO_MODES_V1.includes(normalized)) {
    throw new Error(`mode_locked_in_v17_6:${normalized}`);
  }
  const next = {
    mode: normalized,
    updatedAt: nowIso(),
    updatedBy,
    note: note || "V17.6 dry-run/write-safe mode update",
  };
  const storage = await writeV17AutoStore({ name: "autoMode", value: next });
  return { ...next, storage };
}

export function isDraftMode(mode) {
  return ["DRAFT", "DRY_RUN"].includes(normalizeAutoMode(mode));
}

export function isDryRunMode(mode) {
  return normalizeAutoMode(mode) === "DRY_RUN";
}

export function isRealOrderMode(mode) {
  return ["SEMI_AUTO", "AUTO"].includes(normalizeAutoMode(mode));
}
