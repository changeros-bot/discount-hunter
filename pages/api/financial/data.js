import { neon } from "@neondatabase/serverless";

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}

function clean(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function validDate(value) {
  const v = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function ensureSchema(sql) {
  await sql.query(`create table if not exists public.financial_transactions (
    client_id text primary key,
    tx_date date not null,
    tx_type text not null,
    amount numeric(18,4) not null check (amount >= 0),
    account text not null default '',
    category text not null default '',
    note text not null default '',
    budget_client_id text not null default '',
    migration_batch_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists public.financial_budgets (
    client_id text primary key,
    name text not null,
    category text not null default '',
    amount numeric(18,4) not null check (amount >= 0),
    mode text not null default 'project',
    migration_batch_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists public.financial_assets (
    client_id text primary key,
    name text not null,
    asset_type text not null default '',
    amount numeric(18,4) not null,
    note text not null default '',
    migration_batch_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
}

function rowTx(row) {
  return {
    id: row.client_id,
    date: String(row.tx_date).slice(0, 10),
    type: row.tx_type,
    amount: Number(row.amount),
    account: row.account,
    category: row.category,
    note: row.note,
    budgetId: row.budget_client_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: "neon_not_configured" });
  const sql = neon(url);

  try {
    await ensureSchema(sql);

    if (req.method === "GET") {
      const start = validDate(req.query.start) || "1900-01-01";
      const end = validDate(req.query.end) || "2999-12-31";
      const type = clean(req.query.type, 30);
      const category = clean(req.query.category, 80);
      const account = clean(req.query.account, 80);
      const budgetId = clean(req.query.budgetId, 120);
      const q = clean(req.query.q, 200);
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 300)));

      const transactions = await sql.query(
        `select * from public.financial_transactions
         where tx_date between $1 and $2
           and ($3 = '' or tx_type = $3)
           and ($4 = '' or category = $4)
           and ($5 = '' or account = $5)
           and ($6 = '' or budget_client_id = $6)
           and ($7 = '' or note ilike '%' || $7 || '%' or category ilike '%' || $7 || '%' or account ilike '%' || $7 || '%')
         order by tx_date desc, created_at desc
         limit $8`,
        [start, end, type, category, account, budgetId, q, limit]
      );
      const [budgets, assets] = await Promise.all([
        sql.query(`select * from public.financial_budgets order by created_at asc`),
        sql.query(`select * from public.financial_assets order by created_at asc`),
      ]);
      return res.status(200).json({
        ok: true,
        storage: "neon",
        transactions: transactions.map(rowTx),
        budgets: budgets.map((r) => ({ id: r.client_id, name: r.name, category: r.category, amount: Number(r.amount), mode: r.mode })),
        assets: assets.map((r) => ({ id: r.client_id, name: r.name, type: r.asset_type, amount: Number(r.amount), note: r.note })),
        counts: { transactions: transactions.length, budgets: budgets.length, assets: assets.length },
      });
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const body = req.body || {};
    const entity = clean(body.entity, 30);
    const action = clean(body.action, 30);
    const row = body.row || {};
    const id = clean(row.id || body.id, 120);
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    if (action === "delete") {
      const table = entity === "transaction" ? "financial_transactions" : entity === "budget" ? "financial_budgets" : entity === "asset" ? "financial_assets" : "";
      if (!table) return res.status(400).json({ ok: false, error: "invalid_entity" });
      await sql.query(`delete from public.${table} where client_id=$1`, [id]);
      return res.status(200).json({ ok: true, action, entity, id });
    }

    if (action !== "upsert") return res.status(400).json({ ok: false, error: "invalid_action" });

    if (entity === "transaction") {
      const date = validDate(row.date);
      const amount = number(row.amount);
      if (!date || amount < 0) return res.status(400).json({ ok: false, error: "invalid_transaction" });
      await sql.query(
        `insert into public.financial_transactions
         (client_id,tx_date,tx_type,amount,account,category,note,budget_client_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (client_id) do update set tx_date=excluded.tx_date, tx_type=excluded.tx_type,
         amount=excluded.amount, account=excluded.account, category=excluded.category, note=excluded.note,
         budget_client_id=excluded.budget_client_id, updated_at=now()`,
        [id, date, clean(row.type, 30), amount, clean(row.account, 80), clean(row.category, 80), clean(row.note, 1000), clean(row.budgetId, 120)]
      );
    } else if (entity === "budget") {
      await sql.query(
        `insert into public.financial_budgets (client_id,name,category,amount,mode)
         values ($1,$2,$3,$4,$5)
         on conflict (client_id) do update set name=excluded.name, category=excluded.category,
         amount=excluded.amount, mode=excluded.mode, updated_at=now()`,
        [id, clean(row.name, 200), clean(row.category, 80), number(row.amount), clean(row.mode, 40) || "project"]
      );
    } else if (entity === "asset") {
      await sql.query(
        `insert into public.financial_assets (client_id,name,asset_type,amount,note)
         values ($1,$2,$3,$4,$5)
         on conflict (client_id) do update set name=excluded.name, asset_type=excluded.asset_type,
         amount=excluded.amount, note=excluded.note, updated_at=now()`,
        [id, clean(row.name, 200), clean(row.type, 80), number(row.amount), clean(row.note, 1000)]
      );
    } else {
      return res.status(400).json({ ok: false, error: "invalid_entity" });
    }

    return res.status(200).json({ ok: true, action, entity, id });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "financial_data_failed" });
  }
}
