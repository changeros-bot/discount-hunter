import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, Metric, PageShell, Section } from "../components/v17-dashboard-ui";

const REFRESH_MS = 10000;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount
  }]));
}

export default function V17Dashboard() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = Array.isArray(prices.data) ? prices.data : [];
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      const walletData = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).catch(() => null);
      const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true })
      });
      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      setWallet(walletData);
      setDecisions(today.cards || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString());
      setError("");
    } catch (err) {
      setError(err.message || "V17 讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const classified = useMemo(() => classifyUniverse({
    assets,
    ledger,
    holdings: wallet?.holdings || [],
    decisions
  }), [assets, ledger, wallet, decisions]);

  return <PageShell loading={loading} updatedAt={updatedAt} error={error}>
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
      <Metric label="Universe" value={classified.summary.universeCount} />
      <Metric label="Visible" value={classified.summary.visibleUniqueCount} />
      <Metric label="Decision" value={classified.summary.decisionCount} />
      <Metric label="Holding Zone" value={classified.summary.holdingCount} />
    </section>

    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="暫無 D1-D4 待處理買點" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(245,158,11,.12)", color: "#fde68a", fontWeight: 900 }}>待處理：{row.decision?.statusLabel || row.decision?.status || "queued"}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div>
    </AssetCard>} />

    <Section title="持倉中買點區間" count={classified.holdingRows.length} rows={classified.holdingRows} empty="目前沒有 D1-D4 區間內的持倉" render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(34,197,94,.10)", color: "#bbf7d0", fontWeight: 900 }}>已買層級：{row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : "鏈上持倉"}</div>
    </AssetCard>} />

    <Section title="觀察區 D0" count={classified.watchRows.length} rows={classified.watchRows} empty="目前沒有 D0 觀察標的" render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row} />} />

    {!classified.ok && <section style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(127,29,29,.35)", color: "#fecaca", fontWeight: 900 }}>
      V17 內部分類異常：missing {classified.summary.missingSymbols.join(", ") || "none"} / extra {classified.summary.extraSymbols.join(", ") || "none"}
    </section>}
  </PageShell>;
}
