import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasKvConfig, requiresDurableKv, getJson, setJson } = require("./state/kv");

const memoryStore = globalThis.__V17_AUTO_MEMORY_STORE__ || {
  autoMode: null,
  drafts: null,
  executionLog: null,
};
globalThis.__V17_AUTO_MEMORY_STORE__ = memoryStore;

const DATA_DIR = path.join(process.cwd(), "data", "v17-auto");

function shouldUseFileFallback() {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export const V17_AUTO_PATHS = {
  autoMode: path.join(DATA_DIR, "auto-mode.json"),
  drafts: path.join(DATA_DIR, "trade-drafts.json"),
  executionLog: path.join(DATA_DIR, "execution-log.json"),
};

export const V17_AUTO_KEYS = {
  autoMode: "discount-hunter:v17:auto-mode",
  drafts: "discount-hunter:v17:trade-drafts",
  executionLog: "discount-hunter:v17:execution-log",
};

export async function readV17AutoStore({ name, fallback }) {
  const key = V17_AUTO_KEYS[name];
  const filePath = V17_AUTO_PATHS[name];
  if (!key || !filePath) throw new Error(`invalid_store_name:${name}`);

  if (hasKvConfig()) {
    const response = await getJson(key);
    if (response?.result !== undefined && response?.result !== null) return response.result;
  }

  if (memoryStore[name] !== null && memoryStore[name] !== undefined) return memoryStore[name];
  if (shouldUseFileFallback()) return readJsonFile(filePath, fallback);
  return fallback;
}

export async function writeV17AutoStore({ name, value }) {
  const key = V17_AUTO_KEYS[name];
  const filePath = V17_AUTO_PATHS[name];
  if (!key || !filePath) throw new Error(`invalid_store_name:${name}`);

  if (hasKvConfig()) {
    await setJson(key, value);
    return { store: "upstash_kv" };
  }

  if (requiresDurableKv()) throw new Error("missing_required_upstash_kv");

  memoryStore[name] = value;
  if (shouldUseFileFallback()) {
    try {
      await writeJsonFile(filePath, value);
      return { store: "file_fallback" };
    } catch {
      return { store: "memory_fallback" };
    }
  }

  return { store: "memory_fallback" };
}

export function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nowIso() {
  return new Date().toISOString();
}
