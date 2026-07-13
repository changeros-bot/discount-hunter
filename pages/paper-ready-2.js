import { useEffect, useMemo, useState } from "react";

export default function PaperReady2Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v17/candidate-paper-bootstrap", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (!json?.ok) throw new Error(json?.error || "讀取失敗");
        setData(json);
      })
      .catch((err) => active && setError(err.message || "讀取失敗"));
    return () => { active = false; };
  }, []);

  const positions = data?.positions || [];
  const totals = useMemo(() => ({
    count: positions.length,
    invested: positions.reduce((sum, row) => sum + Number(row.invested_usd || 0), 0),
  }), [positions]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">PAPER TRADING</div>
          <h1>預備名單2</h1>
          <p>18 檔候選標的獨立紙上帳戶，不影響原本 28 檔。</p>
        </div>
        <div className="summary">
          <div><span>標的</span><strong>{totals.count}</strong></div>
          <div><span>投入</span><strong>{totals.invested.toFixed(0)} USD</strong></div>
          <div><span>狀態</span><strong>OPEN</strong></div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="loading">載入預備名單2…</div>}

      <section className="grid">
        {positions.map((row) => (
          <article className="card" key={row.symbol}>
            <div className="top">
              <div>
                <h2>{row.symbol}</h2>
                <small>{row.token_symbol}</small>
              </div>
              <span className={`signal s${row.signal_level}`}>L{row.signal_level}</span>
            </div>
            <div className="metrics">
              <div><span>建倉價</span><b>${Number(row.entry_price).toFixed(4)}</b></div>
              <div><span>投入</span><b>${Number(row.invested_usd).toFixed(2)}</b></div>
              <div><span>數量</span><b>{Number(row.quantity).toFixed(6)}</b></div>
            </div>
            <div className="footer">
              <span>{row.entry_mode === "MANUAL_BASELINE" ? "人工基準建倉" : row.entry_mode}</span>
              <strong>{row.status}</strong>
            </div>
          </article>
        ))}
      </section>

      <style jsx>{`
        :global(body){margin:0;background:#08111f;color:#edf4ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .page{min-height:100vh;padding:24px;max-width:1180px;margin:0 auto}
        .hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;padding:28px;border:1px solid #20304b;border-radius:22px;background:linear-gradient(135deg,#0d1b30,#101827)}
        .eyebrow{font-size:12px;letter-spacing:.18em;color:#7dd3fc;font-weight:800}
        h1{margin:8px 0 6px;font-size:38px}
        p{margin:0;color:#9fb1c8}
        .summary{display:flex;gap:12px;flex-wrap:wrap}
        .summary>div{min-width:92px;padding:12px 14px;border-radius:14px;background:#0a1424;border:1px solid #223552}
        .summary span,.metrics span{display:block;font-size:12px;color:#8295ad;margin-bottom:4px}
        .summary strong{font-size:18px}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:18px}
        .card{padding:18px;border:1px solid #20304b;border-radius:18px;background:#0d1727}
        .top{display:flex;justify-content:space-between;align-items:flex-start}
        h2{margin:0;font-size:24px}
        small{color:#8295ad}
        .signal{padding:5px 9px;border-radius:999px;background:#17243a;color:#b8c7da;font-size:12px;font-weight:800}
        .s1{background:#352b12;color:#facc15}.s2{background:#382018;color:#fb923c}
        .metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
        .metrics b{font-size:14px}
        .footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid #1d2c43;color:#8fa2ba;font-size:12px}
        .footer strong{color:#86efac}
        .loading,.error{margin-top:18px;padding:18px;border-radius:14px;background:#0d1727;border:1px solid #20304b}
        .error{color:#fda4af}
        @media(max-width:700px){.page{padding:14px}.hero{align-items:flex-start;flex-direction:column}.summary{width:100%}.summary>div{flex:1}h1{font-size:32px}}
      `}</style>
    </main>
  );
}
