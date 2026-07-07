import fs from "fs";
import path from "path";

const universeProfiles = [
  { ticker: "AAPL", group: "大型科技平台", trait: "高品質平台股，波動相對可控", strategy: "risk_30d 紙上追蹤；適合平台對照組" },
  { ticker: "MSFT", group: "大型科技平台", trait: "AI雲端與企業軟體核心，趨勢穩定", strategy: "risk_30d 紙上追蹤；適合平台對照組" },
  { ticker: "GOOGL", group: "大型科技平台", trait: "搜尋/雲端/AI平台，估值彈性較大", strategy: "risk_30d 紙上追蹤；訊號出現才做" },
  { ticker: "META", group: "大型科技平台", trait: "廣告現金流強，AI與算力投入大", strategy: "risk_30d 紙上追蹤；平台動能組" },
  { ticker: "AMZN", group: "大型科技平台", trait: "電商加AWS雲端，長週期趨勢股", strategy: "risk_30d 紙上追蹤；平台對照組" },
  { ticker: "NFLX", group: "大型科技平台", trait: "內容平台與訂閱制，受財報與成長預期影響大", strategy: "risk_30d 紙上追蹤；平台波動組" },
  { ticker: "MU", group: "AI半導體", trait: "HBM/記憶體AI基礎建設，波動較大", strategy: "只開沖量/縮量黑馬；不做弱量續攻與波段" },
  { ticker: "DELL", group: "AI基礎建設", trait: "AI伺服器與企業硬體供應鏈，回測穩定", strategy: "risk_30d 正式紙上交易；可全型態觀察" },
  { ticker: "PLTR", group: "AI應用/國防軟體", trait: "高成長高估值，政策與國防AI題材強", strategy: "risk_30d 正式紙上交易；訊號品質優先" },
  { ticker: "NBIS", group: "高波動AI雲端", trait: "高波動AI雲端/算力題材，樣本較少但PF通過", strategy: "高波動觀察組；只開沖量/縮量黑馬" },
];

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
  } catch (e) {
    return null;
  }
}

function toNum(v) {
  const n = Number(String(v ?? "").replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  return String(v).includes("%") ? n / 100 : n;
}

export default function handler(req, res) {
  try {
    const trades = readCsv("2560_paper_trades.csv");
    const open = readCsv("2560_open_positions.csv");
    const closed = readCsv("2560_closed_trades.csv");
    const summaryRows = readCsv("2560_paper_summary.csv");
    const lastScan = readJson("2560_last_scan.json");
    const pending = open.filter((t) => t.status === "PENDING");
    const active = open.filter((t) => t.status === "OPEN");
    const closedReturns = closed.map((t) => toNum(t.return_pct)).filter((n) => Number.isFinite(n));
    const wins = closedReturns.filter((n) => n > 0);
    const losses = closedReturns.filter((n) => n <= 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const summary = {
      total: trades.length,
      pending: pending.length,
      open: active.length,
      closed: closed.length,
      winRate: closedReturns.length ? wins.length / closedReturns.length : null,
      avgReturn: closedReturns.length ? closedReturns.reduce((a, b) => a + b, 0) / closedReturns.length : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      source: "reports/paper",
      mode: "EOD / next-day open paper trading",
      rule: "risk_30d：停損 -8%｜停利 +15%｜最多 30 個交易日",
      universe: universeProfiles.map((x) => x.ticker).join(", "),
      universeProfiles,
      lastScan,
      updatedAt: new Date().toISOString(),
      rawSummary: summaryRows[0] || null,
    };
    res.status(200).json({ ok: true, summary, pending, open: active, closed: closed.slice(-20).reverse() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
