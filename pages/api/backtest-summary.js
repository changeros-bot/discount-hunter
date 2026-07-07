import fs from 'fs';
import path from 'path';

const BACKTEST_DIR = path.join(process.cwd(), 'reports', 'backtests');

const FILES = {
  discount: {
    summary: 'discount_hunter_simulation_summary.csv',
    events: 'discount_hunter_simulation.csv',
    filter2560Summary: 'discount_hunter_2560_summary.csv',
    filter2560Events: 'discount_hunter_2560_events.csv',
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
  if (!raw || raw === 'removed') return { exists: true, rows: [], path: fileName };
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
  if (!raw || raw === 'removed') return { exists: true, rows: [], path: fileName };
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
  const filter2560Summary = readCsv(files.filter2560Summary, 50);
  const filter2560Events = latestRows(files.filter2560Events, 10);
  const firstSummary = summary.rows[0] || null;
  return {
    type,
    status: summary.exists ? 'ready' : 'missing',
    summary: firstSummary,
    recentRows: recent.rows,
    filter2560: {
      status: filter2560Summary.exists ? 'ready' : 'missing',
      summaryRows: filter2560Summary.rows,
      recentRows: filter2560Events.rows,
    },
    files: {
      summary: summary.path,
      events: recent.path,
      filter2560Summary: filter2560Summary.path,
      filter2560Events: filter2560Events.path,
      summaryExists: summary.exists,
      eventsExists: recent.exists,
      filter2560SummaryExists: filter2560Summary.exists,
      filter2560EventsExists: filter2560Events.exists,
    },
  };
}

export default function handler(req, res) {
  try {
    const type = String(req.query.type || 'discount');
    if (type !== 'discount' && type !== 'all') {
      return res.status(404).json({ ok: false, error: 'Only Discount Hunter backtest summary is available.' });
    }

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
          filter2560: 'Research only: compare D_ONLY, D_MA25, D_VOLUME, D_2560.',
        },
      },
    };

    if (type === 'discount') {
      payload.project = buildProject('discount');
    } else {
      payload.projects = { discount: buildProject('discount') };
    }
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'backtest summary failed' });
  }
}
