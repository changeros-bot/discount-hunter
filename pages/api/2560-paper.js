import fs from "fs";
import path from "path";

const patternZh = {
  RUSH_VOLUME: "衝量",
  BUILT_VOLUME: "做量",
  VOLUME_PIT: "縮量坑",
  "沖量": "衝量（舊版）",
  "波段": "做量候選（舊版）",
  "縮量黑馬": "縮量坑（舊版）",
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
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
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function readJsonFrom(base, name) {
  const file = path.join(process.cwd(), base, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function toNum(v) {
  const n = Number(String(v ?? "").replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  return String(v).includes("%") ? n / 100 : n;
}

function normalizeTrade(row) {
  const pattern = row.pattern || row["型態"] || "";
  return {
    ...row,
    pattern,
    pattern_zh: row.pattern_zh || patternZh[pattern] || pattern || "—",
    gate_status: row.gate_status || "LEGACY",
    stage_status: row.stage_status || (row.status === "CLOSED" ? "CLOSED" : "LEGACY"),
    risk_status: row.risk_status || "LEGACY",
    signal_reason: row.signal_reason || "LEGACY_RECORD",
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row?.[key] || "UNKNOWN";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function loadUniverse() {
  const registry = readJsonFrom("config", "2560-universe.json") || { version: "unknown", symbols: [] };
  const seen = new Set();
  const symbols = [];
  for (const item of registry.symbols || []) {
    const ticker = String(item.ticker || "").toUpperCase().trim();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    symbols.push({
      ...item,
      ticker,
      trait: `${item.name || ticker}｜${item.group || "未分類"}`,
      strategy: item.scan_enabled
        ? "納入 2560 紙上掃描；等待價格 5/25 與量能 5/60 完整觸發"
        : "已列入紙上交易母池；等待支援的市場資料來源",
    });
  }
  return { ...registry, symbols };
}

export default function handler(req, res) {
  try {
    const registry = loadUniverse();
    const universeProfiles = registry.symbols;
    const trades = readCsv("2560_paper_trades.csv").map(normalizeTrade);
    const openRows = readCsv("2560_open_positions.csv").map(normalizeTrade);
    const closed = readCsv("2560_closed_trades.csv").map(normalizeTrade);
    const summaryRows = readCsv("2560_paper_summary.csv");
    const lastScan = readJsonFrom("reports/paper", "2560_last_scan.json");
    const pending = openRows.filter((t) => t.status === "PENDING");
    const active = openRows.filter((t) => t.status === "OPEN");
    const closedReturns = closed.map((t) => toNum(t.return_pct)).filter(Number.isFinite);
    const wins = closedReturns.filter((n) => n > 0);
    const losses = closedReturns.filter((n) => n <= 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const scans = lastScan?.scans || [];
    const dataPending = universeProfiles.filter((x) => !x.scan_enabled || !x.data_symbol);
    const enabledProfiles = universeProfiles.filter((x) => x.scan_enabled && x.data_symbol);

    const listCounts = universeProfiles.reduce((acc, item) => {
      const key = item.list || "未分類";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      version: "1.0",
      constitutionStatus: "RATIFIED",
      engineVersion: lastScan?.engine_version || "awaiting-v1-scan",
      registryVersion: registry.version,
      total: trades.length,
      pending: pending.length,
      open: active.length,
      closed: closed.length,
      winRate: closedReturns.length ? wins.length / closedReturns.length : null,
      avgReturn: closedReturns.length ? closedReturns.reduce((a, b) => a + b, 0) / closedReturns.length : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      source: "reports/paper",
      mode: "EOD scan / next-day open paper tracking",
      rule: "結構／ATR 停損優先｜30 日時間失效｜+15% 僅為實驗性紙上目標",
      constitution: "價格 MA5/MA25＋量能 VMA5/VMA60；衝量／做量／縮量坑三分支",
      universe: universeProfiles.map((x) => x.ticker).join(", "),
      universeCount: universeProfiles.length,
      scanEnabledCount: enabledProfiles.length,
      dataPendingCount: dataPending.length,
      listCounts,
      universeProfiles,
      dataPending,
      lastScan,
      scanStats: {
        gate: countBy(scans, "gate_status"),
        stage: countBy(scans, "stage_status"),
        pattern: countBy(scans, "pattern_type"),
        risk: countBy(scans, "risk_status"),
      },
      updatedAt: new Date().toISOString(),
      rawSummary: summaryRows[0] || null,
    };

    res.status(200).json({
      ok: true,
      summary,
      pending,
      open: active,
      closed: closed.slice(-20).reverse(),
      scans,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
