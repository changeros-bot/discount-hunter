import fs from "fs";
import path from "path";
import { get2560StorageStatus, read2560Snapshot } from "../../../lib/2560-store";

const VALID_V1_PATTERNS = new Set(["RUSH_VOLUME", "BUILT_VOLUME", "VOLUME_PIT"]);

function parseCsv(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((row, h, i) => {
      row[h] = values[i] ?? "";
      return row;
    }, {});
  });
}

function readCsv(name) {
  const file = path.join(process.cwd(), "reports", "paper", name);
  return fs.existsSync(file) ? parseCsv(fs.readFileSync(file, "utf8")) : [];
}

function readJson(name) {
  const file = path.join(process.cwd(), "reports", "paper", name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function readRegistry() {
  const file = path.join(process.cwd(), "config", "2560-universe.json");
  if (!fs.existsSync(file)) return { version: "unknown", symbols: [] };
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { version: "invalid", symbols: [] }; }
}

function isV1Trade(row) {
  return VALID_V1_PATTERNS.has(String(row?.pattern || "").trim());
}

function archiveLegacyView(rows) {
  return (rows || []).filter((row) => !isV1Trade(row)).map((row) => ({
    ...row,
    status: "CLOSED",
    exit_date: row.exit_date || row.last_date || "",
    exit_price: row.exit_price || row.last_price || "",
    exit_reason: row.exit_reason || "legacy_rule_replaced",
    signal_reason: "LEGACY_RULE_REPLACED",
  }));
}

function fallbackSnapshot() {
  const trades = readCsv("2560_paper_trades.csv");
  const openRows = readCsv("2560_open_positions.csv");
  const closed = readCsv("2560_closed_trades.csv");
  const rawSummary = readCsv("2560_paper_summary.csv")[0] || null;
  const lastScan = readJson("2560_last_scan.json");
  const registry = readRegistry();
  return {
    schemaVersion: "2560-paper-file-fallback",
    ingestedAt: null,
    trades,
    open: openRows.filter((x) => x.status === "OPEN"),
    pending: openRows.filter((x) => x.status === "PENDING"),
    closed,
    lastScan,
    summary: {
      version: "1.0",
      constitutionStatus: "RATIFIED",
      engineVersion: lastScan?.engine_version || "awaiting-scan",
      registryVersion: registry.version,
      universeCount: (registry.symbols || []).length,
      universeProfiles: registry.symbols || [],
      rawSummary,
      source: "reports/paper",
      storageMode: "file_fallback",
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const stored = await read2560Snapshot();
    const snapshot = stored || fallbackSnapshot();
    const rawOpen = snapshot.open || [];
    const rawPending = snapshot.pending || [];
    const open = rawOpen.filter(isV1Trade);
    const pending = rawPending.filter(isV1Trade);
    const legacyArchived = archiveLegacyView([...rawOpen, ...rawPending]);
    const closed = [...(snapshot.closed || []), ...legacyArchived];

    return res.status(200).json({
      ok: true,
      source: stored ? "upstash_kv" : "github_report_fallback",
      storage: get2560StorageStatus(),
      summary: {
        ...(snapshot.summary || {}),
        open: open.length,
        pending: pending.length,
        closed: closed.length,
        legacyArchived: legacyArchived.length,
        lastScan: snapshot.lastScan || null,
        updatedAt: snapshot.ingestedAt || snapshot.lastScan?.run_at_utc || null,
      },
      pending,
      open,
      closed: closed.slice(-20).reverse(),
      scans: snapshot.lastScan?.scans || [],
      trades: snapshot.trades || [],
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
