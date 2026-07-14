import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}

function text(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function validDate(value) {
  const v = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalize(payload = {}) {
  const transactions = (Array.isArray(payload.transactions) ? payload.transactions : []).slice(0, 10000).map((row) => ({
    id: text(row.id, 120),
    date: validDate(row.date),
    type: text(row.type, 30),
    amount: amount(row.amount),
    account: text(row.account, 80),
    category: text(row.category, 80),
    note: text(row.note, 1000),
    budgetId: text(row.budgetId, 120),
  })).filter((row) => row.id && row.date && row.type && row.amount >= 0);

  const budgets = (Array.isArray(payload.budgets) ? payload.budgets : []).slice(0, 1000).map((row) => ({
    id: text(row.id, 120),
    name: text(row.name, 200),
    category: text(row.category, 80),
    amount: amount(row.amount),
    mode: text(row.mode, 40) || "project",
  })).filter((row) => row.id && row.name && row.amount >= 0);

  const assets = (Array.isArray(payload.assets) ? payload.assets : []).slice(0, 1000).map((row) => ({
    id: text(row.id, 120),
    name: text(row.name, 200),
    type: text(row.type, 80),
    amount: amount(row.amount),
    note: text(row.note, 1000),
  })).filter((row) => row.id && row.name);

  return { transactions, budgets, assets };
}

async function ensureSchema(sql) {
  await sql.query(`create table if not exists public.financial_migration_batches (
    id uuid primary key,
    payload_hash text not null unique,
    source text not null default 'financial-os-localstorage',
    transaction_count integer not null,
    budget_count integer not null,
    asset_count integer not null,
    payload_backup jsonb not null,
    created_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists public.financial_transactions (
    client_id text primary key,
    tx_date date not null,
    tx_type text not null,
    amount numeric(18,4) not null check (amount >= 0),
    account text not null default '',
    category text not null default '',
    note text not null default '',
    budget_client_id text not null default '',
    migration_batch_id uuid references public.financial_migration_batches(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists public.financial_budgets (
    client_id text primary key,
    name text not null,
    category text not null default '',
    amount numeric(18,4) not null check (amount >= 0),
    mode text not null default 'project',
    migration_batch_id uuid references public.financial_migration_batches(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists public.financial_assets (
    client_id text primary key,
    name text not null,
    asset_type text not null default '',
    amount numeric(18,4) not null,
    note text not null default '',
    migration_batch_id uuid references public.financial_migration_batches(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query(`create index if not exists financial_transactions_date_idx on public.financial_transactions(tx_date desc)`);
  await sql.query(`create index if not exists financial_transactions_category_idx on public.financial_transactions(category, tx_date desc)`);
  await sql.query(`create index if not exists financial_transactions_budget_idx on public.financial_transactions(budget_client_id, tx_date desc)`);
}

async function counts(sql) {
  const [tx, budgets, assets] = await Promise.all([
    sql.query(`select count(*)::int as count from public.financial_transactions`),
    sql.query(`select count(*)::int as count from public.financial_budgets`),
    sql.query(`select count(*)::int as count from public.financial_assets`),
  ]);
  return { transactions: Number(tx[0]?.count || 0), budgets: Number(budgets[0]?.count || 0), assets: Number(assets[0]?.count || 0) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: "neon_not_configured" });
  const sql = neon(url);

  try {
    await ensureSchema(sql);

    if (req.method === "GET") {
      return res.status(200).json({ ok: true, storage: "neon", counts: await counts(sql) });
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const data = normalize(req.body || {});
    if (!data.transactions.length && !data.budgets.length && !data.assets.length) {
      return res.status(400).json({ ok: false, error: "empty_migration_payload" });
    }

    const canonical = stableJson(data);
    const payloadHash = crypto.createHash("sha256").update(canonical).digest("hex");
    const batchId = crypto.randomUUID();

    const existing = await sql.query(`select id from public.financial_migration_batches where payload_hash=$1 limit 1`, [payloadHash]);
    const effectiveBatchId = existing[0]?.id || batchId;

    if (!existing[0]) {
      await sql.query(
        `insert into public.financial_migration_batches
         (id,payload_hash,transaction_count,budget_count,asset_count,payload_backup)
         values ($1,$2,$3,$4,$5,$6::jsonb)`,
        [batchId, payloadHash, data.transactions.length, data.budgets.length, data.assets.length, canonical]
      );
    }

    for (const row of data.transactions) {
      await sql.query(
        `insert into public.financial_transactions
         (client_id,tx_date,tx_type,amount,account,category,note,budget_client_id,migration_batch_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (client_id) do update set
           tx_date=excluded.tx_date, tx_type=excluded.tx_type, amount=excluded.amount,
           account=excluded.account, category=excluded.category, note=excluded.note,
           budget_client_id=excluded.budget_client_id, migration_batch_id=excluded.migration_batch_id,
           updated_at=now()`,
        [row.id, row.date, row.type, row.amount, row.account, row.category, row.note, row.budgetId, effectiveBatchId]
      );
    }

    for (const row of data.budgets) {
      await sql.query(
        `insert into public.financial_budgets
         (client_id,name,category,amount,mode,migration_batch_id)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (client_id) do update set
           name=excluded.name, category=excluded.category, amount=excluded.amount,
           mode=excluded.mode, migration_batch_id=excluded.migration_batch_id, updated_at=now()`,
        [row.id, row.name, row.category, row.amount, row.mode, effectiveBatchId]
      );
    }

    for (const row of data.assets) {
      await sql.query(
        `insert into public.financial_assets
         (client_id,name,asset_type,amount,note,migration_batch_id)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (client_id) do update set
           name=excluded.name, asset_type=excluded.asset_type, amount=excluded.amount,
           note=excluded.note, migration_batch_id=excluded.migration_batch_id, updated_at=now()`,
        [row.id, row.name, row.type, row.amount, row.note, effectiveBatchId]
      );
    }

    const databaseCounts = await counts(sql);
    return res.status(200).json({
      ok: true,
      storage: "neon",
      migration: {
        batchId: effectiveBatchId,
        payloadHash,
        idempotentReplay: Boolean(existing[0]),
        uploaded: { transactions: data.transactions.length, budgets: data.budgets.length, assets: data.assets.length },
        databaseCounts,
        localDataDeletionRequired: false,
        backupStored: true,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "financial_migration_failed" });
  }
}
