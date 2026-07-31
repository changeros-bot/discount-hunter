import { neon } from '@neondatabase/serverless';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || '';
}

function validDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function ensureSchema(sql) {
  await sql.query(`create table if not exists public.financial_asset_history (
    snapshot_date date primary key,
    total_twd numeric(18,4) not null,
    manual_twd numeric(18,4) not null default 0,
    investment_usd numeric(18,8) not null default 0,
    exchange_rate numeric(18,6) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: 'neon_not_configured' });
  const sql = neon(url);

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const limit = Math.min(365, Math.max(1, Number(req.query.limit || 30)));
      const rows = await sql.query(
        `select to_char(snapshot_date, 'YYYY-MM-DD') as date,
                total_twd, manual_twd, investment_usd, exchange_rate
         from public.financial_asset_history
         order by snapshot_date desc
         limit $1`,
        [limit]
      );
      return res.status(200).json({
        ok: true,
        rows: rows.reverse().map((row) => ({
          date: row.date,
          total: Number(row.total_twd),
          manual: Number(row.manual_twd),
          investmentUsd: Number(row.investment_usd),
          rate: Number(row.exchange_rate),
        })),
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    const body = req.body || {};
    const date = validDate(body.date);
    const total = Number(body.total);
    const manual = Number(body.manual || 0);
    const investmentUsd = Number(body.investmentUsd || 0);
    const rate = Number(body.rate || 0);
    if (!date || !Number.isFinite(total) || !Number.isFinite(manual) || !Number.isFinite(investmentUsd) || !Number.isFinite(rate)) {
      return res.status(400).json({ ok: false, error: 'invalid_snapshot' });
    }

    await sql.query(
      `insert into public.financial_asset_history
       (snapshot_date,total_twd,manual_twd,investment_usd,exchange_rate)
       values ($1,$2,$3,$4,$5)
       on conflict (snapshot_date) do update set
         total_twd=excluded.total_twd,
         manual_twd=excluded.manual_twd,
         investment_usd=excluded.investment_usd,
         exchange_rate=excluded.exchange_rate,
         updated_at=now()`,
      [date, total, manual, investmentUsd, rate]
    );

    return res.status(200).json({ ok: true, date, total });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'asset_history_failed' });
  }
}
