import fs from 'fs';
import path from 'path';

const BACKTEST_DIR = path.join(process.cwd(), 'reports', 'backtests');

const FILES = {
  discount: {
    summary: 'discount_hunter_simulation_summary.csv',
    events: 'discount_hunter_simulation.csv',
  },
  leveraged: {
    summary: 'leveraged_hunter_simulation_summary.csv',
    events: 'leveraged_hunter_simulation.csv',
    byTicker: 'leveraged_hunter_simulation_by_ticker.csv',
    bySignal: 'leveraged_hunter_simulation_by_signal.csv',
  },
};

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function coerce(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isNaN(n) && String(value).trim() !== '') return n;
  return value;
}

function readCsv(fileName, limit = 50) {
  const fullPath = path.join(BACKTEST_DIR, fileName);
  if (!fileName || !fs.existsSync(fullPath)) return { exists: false, rows: [], path: fileName };
  const raw = fs.readFileSync(fullPath, 'utf8').trim();
  if (!raw) return { exists: true, rows: [], path: fileName };
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1, limit + 1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, coerce(values[idx])]));
  });
  return { exists: true, rows, path: fileName };
}

function latestRows(fileName, limit = 10) {
  const fullPath = path.join(BACKTEST_DIR, fileName);
  if (!fileName || !fs.existsSync(fullPath)) return { exists: false, rows: [], path: fileName };
  const raw = fs.readFileSync(fullPath, 'utf8').trim();
  if (!raw) return { exists: true, rows: [], path: fileName };
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).slice(-limit).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, coerce(values[idx])]));
  });
  return { exists: true, rows, path: fileName };
}

function buildProject(type) {
  const files = FILES[type];
  const summary = readCsv(files.summary, 5);
  const recent = latestRows(files.events, 10);
  const firstSummary = summary.rows[0] || null;
  const byTicker = files.byTicker ? readCsv(files.byTicker, 25) : { exists: false, rows: [], path: null };
  const bySignal = files.bySignal ? readCsv(files.bySignal, 10) : { exists: false, rows: [], path: null };
  return {
    type,
    status: summary.exists ? 'ready' : 'missing',
    summary: firstSummary,
    recentRows: recent.rows,
    byTicker: byTicker.rows,
    bySignal: bySignal.rows,
    files: {
      summary: summary.path,
      events: recent.path,
      byTicker: byTicker.path,
      bySignal: bySignal.path,
      summaryExists: summary.exists,
      eventsExists: recent.exists,
      byTickerExists: byTicker.exists,
      bySignalExists: bySignal.exists,
    },
  };
}

export default function handler(req, res) {
  try {
    const type = String(req.query.type || 'all');
    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      note: 'Backtest summary is read-only. Missing means reports/backtests CSV has not been generated yet.',
      parameters: {
        discount: {
          tradeSize: '5U',
          monthlyBudget: '100U',
          totalCapital: '300U',
          singleAssetLimit: '40U',
        },
        leveraged: {
          tradeSize: '5U',
          totalCapital: '50U',
          singleAssetLimit: '15U',
          takeProfit: '12%',
          stopLoss: '8%',
          holdDays: 30,
          riskOffSignals: ['C_過度波動禁止型'],
        },
      },
    };

    if (type === 'discount' || type === 'leveraged') {
      payload.project = buildProject(type);
    } else {
      payload.projects = {
        discount: buildProject('discount'),
        leveraged: buildProject('leveraged'),
      };
    }
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'backtest summary failed' });
  }
}
