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
  const res = await fetch(`${proto}://${host}/api/v17/candidate-lab?t=${Date.now()}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `candidate-lab ${res.status}`);
  return json;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const url = connectionString();
    if (!url) return res.status(503).json({ ok:false, error:"neon_not_configured" });
    const sql = neon(url);
    const rows = await sql.query(`select symbol, token_symbol, opened_at, entry_price, quantity, invested_usd, signal_level, entry_mode, status from public.candidate_paper_positions order by opened_at, symbol`);
    return res.status(200).json({ ok:true, mode:"CANDIDATE_PAPER_ONLY", count:rows.length, investedUsd:rows.reduce((s,r)=>s+Number(r.invested_usd||0),0), positions:rows, safeguards:{paperOnly:true, realOrders:false, modifiesExistingPaper28:false} });
  }
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  if (!authorized(req)) return res.status(401).json({ ok:false, error:"unauthorized" });

  try {
    const url = connectionString();
    if (!url) return res.status(503).json({ ok:false, error:"neon_not_configured" });
    const lab = await fetchLab(req);
    const bySymbol = Object.fromEntries((lab.rows || []).map(r => [r.symbol === "DRAMB" ? "DRAM" : r.symbol, r]));
    const missing = SYMBOLS.filter(s => !bySymbol[s] || !(Number(bySymbol[s].price) > 0));
    if (missing.length) return res.status(409).json({ ok:false, error:"missing_prices", missing });

    const sql = neon(url);
    const inserted = [];
    for (const symbol of SYMBOLS) {
      const row = bySymbol[symbol];
      const price = Number(row.price);
      const token = TOKEN_MAP[symbol];
      const result = await sql.query(
        `insert into public.candidate_paper_positions
          (symbol, token_symbol, entry_price, quantity, invested_usd, signal_level, source_snapshot_at, entry_mode, status)
         select $1,$2,$3,$4,$5,$6,$7,'MANUAL_BASELINE','OPEN'
         where not exists (select 1 from public.candidate_paper_positions where symbol=$1 and status='OPEN')
         returning symbol, token_symbol, entry_price, quantity, invested_usd, signal_level, entry_mode, status`,
        [symbol, token, price, 5/price, 5, Number(row.signal?.level || 0), row.quoteAudit?.checkedAt || new Date().toISOString()]
      );
      if (result[0]) inserted.push(result[0]);
    }
    const positions = await sql.query(`select symbol, token_symbol, opened_at, entry_price, quantity, invested_usd, signal_level, entry_mode, status from public.candidate_paper_positions where status='OPEN' order by symbol`);
    return res.status(200).json({ ok:true, mode:"CANDIDATE_PAPER_BOOTSTRAP", requested:18, inserted:inserted.length, openPositions:positions.length, investedUsd:positions.reduce((s,r)=>s+Number(r.invested_usd||0),0), positions, safeguards:{paperOnly:true, realOrders:false, modifiesExistingPaper28:false, idempotent:true} });
  } catch (error) {
    return res.status(500).json({ ok:false, error:error?.message || "candidate_paper_bootstrap_failed" });
  }
}
