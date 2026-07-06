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
    researchSummary: 'leveraged_hunter_research_summary.csv',
    researchEvents: 'leveraged_hunter_research.csv',
    researchByTicker: 'leveraged_hunter_research_by_ticker.csv',
    researchBySignal: 'leveraged_hunter_research_by_signal.csv',
    researchByRegime: 'leveraged_hunter_research_by_regime.csv',
    researchByRegimeSignal: 'leveraged_hunter_research_by_regime_signal.csv',
    researchByRegimeTicker: 'leveraged_hunter_research_by_regime_ticker.csv',
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
  const researchSummary = files.researchSummary ? readCsv(files.researchSummary, 5) : { exists: false, rows: [], path: null };
  const researchByTicker = files.researchByTicker ? readCsv(files.researchByTicker, 30) : { exists: false, rows: [], path: null };
  const researchBySignal = files.researchBySignal ? readCsv(files.researchBySignal, 10) : { exists: false, rows: [], path: null };
  const researchByRegime = files.researchByRegime ? readCsv(files.researchByRegime, 10) : { exists: false, rows: [], path: null };
  const researchByRegimeSignal = files.researchByRegimeSignal ? readCsv(files.researchByRegimeSignal, 30) : { exists: false, rows: [], path: null };
  const researchByRegimeTicker = files.researchByRegimeTicker ? readCsv(files.researchByRegimeTicker, 80) : { exists: false, rows: [], path: null };
  return {
    type,
    status: summary.exists ? 'ready' : 'missing',
    summary: firstSummary,
    recentRows: recent.rows,
    byTicker: byTicker.rows,
    bySignal: bySignal.rows,
    research: {
      status: researchSummary.exists ? 'ready' : 'missing',
      summary: researchSummary.rows[0] || null,
      byTicker: researchByTicker.rows,
      bySignal: researchBySignal.rows,
      byRegime: researchByRegime.rows,
      byRegimeSignal: researchByRegimeSignal.rows,
      byRegimeTicker: researchByRegimeTicker.rows,
    },
    files: {
      summary: summary.path,
      events: recent.path,
      byTicker: byTicker.path,
      bySignal: bySignal.path,
      researchSummary: researchSummary.path,
      researchByTicker: researchByTicker.path,
      researchBySignal: researchBySignal.path,
      researchByRegime: researchByRegime.path,
      researchByRegimeSignal: researchByRegimeSignal.path,
      researchByRegimeTicker: researchByRegimeTicker.path,
      summaryExists: summary.exists,
      eventsExists: recent.exists,
      byTickerExists: byTicker.exists,
      bySignalExists: bySignal.exists,
      researchSummaryExists: researchSummary.exists,
      researchByRegimeExists: researchByRegime.exists,
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
          regimes: ['2015-2019', '2020-2021', '2022', '2023-2024', '2025-now'],
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
