import { useEffect, useMemo, useState } from "react";

const money = (value, currency) => {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

function Card({ children, style = {} }) {
  return <section style={{ background: "rgba(17,24,39,.94)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>;
}

function Metric({ label, value, accent }) {
  return <div style={{ background: "rgba(2,6,23,.55)", borderRadius: 15, padding: 12 }}>
    <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900 }}>{label}</div>
    <div style={{ color: accent || "#f8fafc", fontSize: 19, fontWeight: 1000, marginTop: 5 }}>{value}</div>
  </div>;
}

function AssetCard({ asset }) {
  const live = asset.status === "LIVE";
  const active = asset.level?.active || 0;
  const pnl = asset.liveHolding?.pnl || 0;
  const hasHolding = asset.holding?.shares > 0;
  return <Card style={{ borderColor: active ? "rgba(34,197,94,.52)" : "rgba(56,189,248,.24)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "#7dd3fc", fontSize: 24, fontWeight: 1000 }}>{asset.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3, fontWeight: 800 }}>{asset.name}</div>
      </div>
      <span style={{ color: live ? "#86efac" : "#fca5a5", border: `1px solid ${live ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.4)"}`, borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 1000 }}>{asset.status}</span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
      <Metric label="真實價格" value={money(asset.price, asset.currency)} />
      <Metric label="52 週高點" value={money(asset.high52w, asset.currency)} />
    </div>

    <div style={{ marginTop: 12, padding: 13, borderRadius: 16, background: "rgba(3,105,161,.14)", border: "1px solid rgba(56,189,248,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>距高點回撤</div>
          <div style={{ fontSize: 29, fontWeight: 1000, marginTop: 3 }}>{asset.discount == null ? "—" : `${asset.discount.toFixed(2)}%`}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: asset.ladderEnabled ? (active ? "#86efac" : "#bae6fd") : "#cbd5e1", fontSize: 14, fontWeight: 1000 }}>{asset.ladderEnabled ? (asset.level?.label || "資料未就緒") : "僅固定 DCA"}</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5, fontWeight: 850 }}>{asset.ladderEnabled ? (active ? `加碼 ${money(asset.level.buyAmount, asset.currency)}` : `下一層 ${asset.level?.nextRule}%`) : "未啟用分層買點"}</div>
        </div>
      </div>
    </div>

    <div style={{ marginTop: 14 }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, marginBottom: 8 }}>富邦實際持倉</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="持有股數" value={hasHolding ? asset.holding.shares : "尚未持有"} />
        <Metric label="投資成本" value={money(asset.holding.cost, asset.currency)} />
        <Metric label="成交均價" value={hasHolding ? money(asset.holding.averageCost, asset.currency) : "—"} />
        <Metric label="即時估算損益" value={hasHolding ? `${pnl >= 0 ? "+" : ""}${money(pnl, asset.currency)} (${asset.liveHolding.pnlPct}%)` : "—"} accent={pnl >= 0 ? "#86efac" : "#fca5a5"} />
      </div>
      {asset.symbol === "VOO" && hasHolding && <div style={{ color: "#64748b", fontSize: 11, marginTop: 9 }}>富邦截圖：市值 US$30.61／成本 US$30.09／原幣損益 +US$0.52；匯率 32.2775。</div>}
      {asset.symbol === "0050" && hasHolding && <div style={{ color: "#64748b", fontSize: 11, marginTop: 9 }}>富邦截圖：37 股／市值 NT$3,899／成本 NT$3,867／損益 +NT$32。</div>}
    </div>

    {asset.ladderEnabled && <div style={{ marginTop: 14 }}>
      {asset.rules.map((rule, index) => {
        const reached = active >= index + 1;
        return <div key={rule} style={{ display: "grid", gridTemplateColumns: "44px 68px 1fr", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.1)", color: reached ? "#86efac" : "#cbd5e1" }}>
          <div style={{ fontSize: 12, fontWeight: 1000 }}>L{index + 1}</div>
          <div style={{ fontSize: 13, fontWeight: 1000 }}>{rule}%</div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 900 }}>{money(asset.amounts[index], asset.currency)}</div>
        </div>;
      })}
    </div>}

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
          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>LIVE PRICE + HOLDINGS</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>富邦長期 DCA</h1>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, fontWeight: 800 }}>0050 / VOO / QQQM｜真實價格、持倉與買點</div>
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
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 8 }}>執行規則</div>
        <div style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 13, fontWeight: 800 }}>固定 DCA 永不中斷，三檔皆保留回撤分層加碼。0050、VOO：-10/-20/-30/-40%；QQQM：-15/-25/-35/-45%。分層買點只提供加碼決策，不自動下單。</div>
      </Card>
    </div>
  </main>;
}
