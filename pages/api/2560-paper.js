import fs from "fs";
import path from "path";

const universeProfiles = [
  { ticker: "AAPL", group: "大型科技平台", trait: "高品質平台股，波動相對可控", strategy: "完整 2560 三模式掃描；紙上交易驗證" },
  { ticker: "MSFT", group: "大型科技平台", trait: "AI 雲端與企業軟體核心，趨勢穩定", strategy: "完整 2560 三模式掃描；紙上交易驗證" },
  { ticker: "GOOGL", group: "大型科技平台", trait: "搜尋、雲端與 AI 平台", strategy: "價格 5/25＋量能 5/60；訊號成立才追蹤" },
  { ticker: "META", group: "大型科技平台", trait: "廣告現金流與 AI 算力投入", strategy: "完整 2560 三模式掃描；量價共同確認" },
  { ticker: "AMZN", group: "大型科技平台", trait: "電商加 AWS 雲端，長週期趨勢股", strategy: "完整 2560 三模式掃描；紙上交易驗證" },
  { ticker: "NFLX", group: "大型科技平台", trait: "內容平台，財報與成長預期敏感", strategy: "完整 2560 三模式掃描；事件風險需注意" },
  { ticker: "MU", group: "AI 半導體", trait: "HBM／記憶體 AI 基礎建設，波動較大", strategy: "限衝量／縮量坑；不開未成熟做量訊號" },
  { ticker: "DELL", group: "AI 基礎建設", trait: "AI 伺服器與企業硬體供應鏈", strategy: "完整 2560 三模式掃描；做量模式優先" },
  { ticker: "PLTR", group: "AI 應用／國防軟體", trait: "高成長高估值，政策與國防 AI 題材強", strategy: "完整 2560 三模式掃描；訊號品質優先" },
  { ticker: "NBIS", group: "高波動 AI 雲端", trait: "高波動雲端／算力題材，樣本較少", strategy: "限衝量／縮量坑；高波動觀察組" },
];

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

function readJson(name) {
  const file = path.join(process.cwd(), "reports", "paper", name);
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

export default function handler(req, res) {
  try {
    const trades = readCsv("2560_paper_trades.csv").map(normalizeTrade);
    const openRows = readCsv("2560_open_positions.csv").map(normalizeTrade);
    const closed = readCsv("2560_closed_trades.csv").map(normalizeTrade);
    const summaryRows = readCsv("2560_paper_summary.csv");
    const lastScan = readJson("2560_last_scan.json");
    const pending = openRows.filter((t) => t.status === "PENDING");
    const active = openRows.filter((t) => t.status === "OPEN");
    const closedReturns = closed.map((t) => toNum(t.return_pct)).filter(Number.isFinite);
    const wins = closedReturns.filter((n) => n > 0);
    const losses = closedReturns.filter((n) => n <= 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const scans = lastScan?.scans || [];

    const summary = {
      version: "1.0",
      constitutionStatus: "RATIFIED",
      engineVersion: lastScan?.engine_version || "awaiting-v1-scan",
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
      universeProfiles,
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
