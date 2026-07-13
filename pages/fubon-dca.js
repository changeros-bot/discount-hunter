import { useEffect, useMemo, useState } from "react";

const money = (value, currency) => {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 2 : 2,
  }).format(Number(value));
};

function Card({ children, style = {} }) {
  return <section style={{ background: "rgba(17,24,39,.94)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>;
}

function AssetCard({ asset }) {
  const live = asset.status === "LIVE";
  const active = asset.level?.active || 0;
  const nextRule = asset.level?.nextRule;
  return <Card style={{ borderColor: active ? "rgba(34,197,94,.52)" : "rgba(56,189,248,.24)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "#7dd3fc", fontSize: 24, fontWeight: 1000 }}>{asset.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3, fontWeight: 800 }}>{asset.name}</div>
      </div>
      <span style={{ color: live ? "#86efac" : "#fca5a5", border: `1px solid ${live ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.4)"}`, borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 1000 }}>{asset.status}</span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
      <div style={{ background: "rgba(2,6,23,.55)", borderRadius: 15, padding: 12 }}>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900 }}>真實價格</div>
        <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 5 }}>{money(asset.price, asset.currency)}</div>
      </div>
      <div style={{ background: "rgba(2,6,23,.55)", borderRadius: 15, padding: 12 }}>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900 }}>52 週高點</div>
        <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 5 }}>{money(asset.high52w, asset.currency)}</div>
      </div>
    </div>

    <div style={{ marginTop: 12, padding: 13, borderRadius: 16, background: active ? "rgba(22,101,52,.22)" : "rgba(3,105,161,.14)", border: `1px solid ${active ? "rgba(34,197,94,.35)" : "rgba(56,189,248,.25)"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>距高點回撤</div>
          <div style={{ color: active ? "#86efac" : "#f8fafc", fontSize: 29, fontWeight: 1000, marginTop: 3 }}>{asset.discount == null ? "—" : `${asset.discount.toFixed(2)}%`}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: active ? "#86efac" : "#bae6fd", fontSize: 14, fontWeight: 1000 }}>{asset.level?.label || "資料未就緒"}</div>
          <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 5, fontWeight: 850 }}>{active ? `建議加碼 ${money(asset.level.buyAmount, asset.currency)}` : nextRule != null ? `下一層 ${nextRule}%` : "已達最深層"}</div>
        </div>
      </div>
    </div>

    <div style={{ marginTop: 14 }}>
      {asset.rules.map((rule, index) => {
        const reached = active >= index + 1;
        return <div key={rule} style={{ display: "grid", gridTemplateColumns: "44px 68px 1fr", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.1)", color: reached ? "#86efac" : "#cbd5e1" }}>
          <div style={{ fontSize: 12, fontWeight: 1000 }}>L{index + 1}</div>
          <div style={{ fontSize: 13, fontWeight: 1000 }}>{rule}%</div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 900 }}>{money(asset.amounts[index], asset.currency)}</div>
        </div>;
      })}
    </div>

    <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.5, marginTop: 10, fontWeight: 750 }}>每月 12 日固定 DCA：{money(asset.monthlyAmount, asset.currency)}。分層加碼不取代固定扣款。</div>
  </Card>;
}

export default function FubonDcaPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`/api/fubon-quotes?_=${Date.now()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || `HTTP ${response.status}`);
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message || "報價更新失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const liveCount = useMemo(() => data?.quotes?.filter((item) => item.status === "LIVE").length || 0, [data]);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>LIVE PRICE ENGINE</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>富邦長期 DCA</h1>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, fontWeight: 800 }}>0050 / VOO / QQQM｜52 週高點分層買進</div>
        </div>
        <a href="/" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回首頁</a>
      </header>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>報價狀態</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 1000 }}>{loading ? "更新中…" : `${liveCount}/3 正常`}</div>
          </div>
          <button onClick={refresh} disabled={loading} style={{ border: "1px solid rgba(56,189,248,.4)", background: "rgba(14,116,144,.16)", color: "#bae6fd", borderRadius: 13, padding: "9px 12px", fontWeight: 1000 }}>{loading ? "讀取中" : "立即更新"}</button>
        </div>
        {data?.checkedAt && <div style={{ color: "#64748b", fontSize: 11, marginTop: 9 }}>更新：{new Date(data.checkedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</div>}
        {error && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 9 }}>{error}</div>}
      </Card>

      {data?.quotes?.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}

      {!data && !error && <Card><div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>正在載入真實市場資料…</div></Card>}

      <Card>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 8 }}>系統憲法</div>
        <div style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 13, fontWeight: 800 }}>固定 DCA 永不中斷；層級買點只負責市場大幅回撤時加碼。0050、VOO：-10/-20/-30/-40%；QQQM：-15/-25/-35/-45%。資料源為 Yahoo Finance 1 年日線，價格可能延遲，不自動下單。</div>
      </Card>
    </div>
  </main>;
}
