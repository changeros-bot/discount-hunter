import { neon } from "@neondatabase/serverless";

const SYMBOLS = ["AAPL","AMZN","KO","BAC","AXP","CVX","XOM","LIN","NOC","UNH","MU","SNDK","WDC","STX","SKHY","DRAM","OXY","PBR"];
const TOKEN_MAP = { AAPL:"AAPLon", AMZN:"AMZNon", KO:"KOon", BAC:"BACon", AXP:"AXPon", CVX:"CVXon", XOM:"XOMon", LIN:"LINon", NOC:"NOCon", UNH:"UNHon", MU:"MUon", SNDK:"SNDKon", WDC:"WDCon", STX:"STXon", SKHY:"SKHYon", DRAM:"DRAMon", OXY:"OXYon", PBR:"PBRon" };

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}
function authorized(req) {
  const expected = process.env.CANDIDATE_LAB_WRITE_SECRET || process.env.CRON_SECRET || "";
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(expected) && provided === expected;
}
async function fetchLab(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const response = await fetch(`${proto}://${host}/api/v17/candidate-lab?t=${Date.now()}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok || json?.ok === false) throw new Error(json?.error || `candidate-lab ${response.status}`);
  return json;
}
async function readPositions(sql) {
  return sql.query(`select symbol, token_symbol, opened_at, entry_price, quantity, invested_usd, signal_level, entry_mode, status from public.candidate_paper_positions where status='OPEN' order by symbol`);
}
async function bootstrap(req, sql) {
  const lab = await fetchLab(req);
  const bySymbol = Object.fromEntries((lab.rows || []).map((row) => [row.symbol === "DRAMB" ? "DRAM" : row.symbol, row]));
  const missing = SYMBOLS.filter((symbol) => !bySymbol[symbol] || !(Number(bySymbol[symbol].price) > 0));
  if (missing.length) return { conflict: true, missing };

  const inserted = [];
  for (const symbol of SYMBOLS) {
    const row = bySymbol[symbol];
    const price = Number(row.price);
    const result = await sql.query(
      `insert into public.candidate_paper_positions
        (symbol, token_symbol, entry_price, quantity, invested_usd, signal_level, source_snapshot_at, entry_mode, status)
       select $1,$2,$3,$4,$5,$6,$7,'MANUAL_BASELINE','OPEN'
       where not exists (select 1 from public.candidate_paper_positions where symbol=$1 and status='OPEN')
       returning symbol, token_symbol, entry_price, quantity, invested_usd, signal_level, entry_mode, status`,
      [symbol, TOKEN_MAP[symbol], price, 5 / price, 5, Number(row.signal?.level || 0), row.quoteAudit?.checkedAt || new Date().toISOString()]
    );
    if (result[0]) inserted.push(result[0]);
  }
  return { inserted };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = connectionString();
  if (!url) return res.status(503).json({ ok:false, error:"neon_not_configured" });
  const sql = neon(url);

  try {
    if (req.method === "POST") {
      if (!authorized(req)) return res.status(401).json({ ok:false, error:"unauthorized" });
      const result = await bootstrap(req, sql);
      if (result.conflict) return res.status(409).json({ ok:false, error:"missing_prices", missing:result.missing });
      const positions = await readPositions(sql);
      return res.status(200).json({ ok:true, mode:"CANDIDATE_PAPER_BOOTSTRAP", requested:18, inserted:result.inserted.length, openPositions:positions.length, investedUsd:positions.reduce((sum,row)=>sum+Number(row.invested_usd||0),0), positions, safeguards:{paperOnly:true, realOrders:false, modifiesExistingPaper28:false, idempotent:true} });
    }

    if (req.method === "GET") {
      const positions = await readPositions(sql);
      return res.status(200).json({ ok:true, mode:"CANDIDATE_PAPER_ONLY", count:positions.length, investedUsd:positions.reduce((sum,row)=>sum+Number(row.invested_usd||0),0), positions, safeguards:{paperOnly:true, realOrders:false, modifiesExistingPaper28:false} });
    }
    return res.status(405).json({ ok:false, error:"method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok:false, error:error?.message || "candidate_paper_bootstrap_failed" });
  }
}
