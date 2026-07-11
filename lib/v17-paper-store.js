import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasKvConfig, requiresDurableKv, getJson, setJson } = require("./state/kv");

const DATA_DIR = path.join(process.cwd(), "data", "v17-paper");
const memoryStore = globalThis.__V17_PAPER_MEMORY_STORE__ || {
  trades: null,
  settings: null,
  market45: null,
};
globalThis.__V17_PAPER_MEMORY_STORE__ = memoryStore;

const KEYS = {
  trades: "discount-hunter:v17-paper:trades",
  settings: "discount-hunter:v17-paper:settings",
  market45: "discount-hunter:v17-paper:market-45-review",
};

const PATHS = {
  trades: path.join(DATA_DIR, "paper-trades.json"),
  settings: path.join(DATA_DIR, "paper-settings.json"),
  market45: path.join(DATA_DIR, "market-45-review.json"),
};

function shouldUseFileFallback() {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readPaperStore(name, fallback) {
  if (!KEYS[name]) throw new Error(`invalid_paper_store:${name}`);
  if (hasKvConfig()) {
    const response = await getJson(KEYS[name]);
    if (response?.result !== undefined && response?.result !== null) return response.result;
  }
  if (memoryStore[name] !== null && memoryStore[name] !== undefined) return memoryStore[name];
  if (shouldUseFileFallback()) return readJsonFile(PATHS[name], fallback);
  return fallback;
}

export async function writePaperStore(name, value) {
  if (!KEYS[name]) throw new Error(`invalid_paper_store:${name}`);
  if (hasKvConfig()) {
    await setJson(KEYS[name], value);
    return { store: "upstash_kv" };
  }
  if (requiresDurableKv()) throw new Error("missing_required_upstash_kv");
  memoryStore[name] = value;
  if (shouldUseFileFallback()) {
    try {
      await writeJsonFile(PATHS[name], value);
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
