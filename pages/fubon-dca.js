import { useEffect, useMemo, useState } from "react";

const money = (value, currency) => {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const targetPrice = (high52w, rule) => {
  const high = Number(high52w);
  const drop = Number(rule);
  if (!Number.isFinite(high) || high <= 0 || !Number.isFinite(drop)) return null;
  return Number((high * (1 + drop / 100)).toFixed(2));
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
  const livePnl = asset.liveHolding?.pnl || 0;
  const brokerPnl = asset.holding?.brokerPnl || 0;
  const hasHolding = asset.holding?.shares > 0;
  const nextPrice = asset.level?.nextRule == null ? null : targetPrice(asset.high52w, asset.level.nextRule);
  const snapshotText = asset.holding?.snapshotAt
    ? new Date(asset.holding.snapshotAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    : "未提供";

  return <Card style={{ borderColor: active ? "rgba(34,197,94,.52)" : "rgba(56,189,248,.24)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "#7dd3fc", fontSize: 24, fontWeight: 1000 }}>{asset.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3, fontWeight: 800 }}>{asset.name}</div>
      </div>
      <span style={{ color: live ? "#86efac" : "#fca5a5", border: `1px solid ${live ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.4)"}`, borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 1000 }}>{asset.status}</span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
      <Metric label="公開市場價格" value={money(asset.price, asset.currency)} />
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
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5, fontWeight: 850 }}>{asset.ladderEnabled ? (active ? `本層加碼 ${money(asset.level.buyAmount, asset.currency)}` : `下一層 ${asset.level?.nextRule}%`) : "未啟用分層買點"}</div>
          {asset.ladderEnabled && nextPrice != null && <div style={{ color: "#f8fafc", fontSize: 13, marginTop: 4, fontWeight: 1000 }}>價格 ≤ {money(nextPrice, asset.currency)}</div>}
        </div>
      </div>
    </div>

    <div style={{ marginTop: 14 }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, marginBottom: 8 }}>富邦持倉基礎資料</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="持有股數" value={hasHolding ? asset.holding.shares : "尚未持有"} />
        <Metric label="投資成本" value={money(asset.holding.cost, asset.currency)} />
        <Metric label="成交均價" value={hasHolding ? money(asset.holding.averageCost, asset.currency) : "—"} />
        <Metric label="富邦截圖市值" value={hasHolding ? money(asset.holding.brokerMarketValue, asset.currency) : "—"} />
      </div>
    </div>

    {hasHolding && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div style={{ background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 16, padding: 12 }}>
        <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 1000 }}>富邦帳面損益</div>
        <div style={{ color: brokerPnl >= 0 ? "#86efac" : "#fca5a5", fontSize: 19, fontWeight: 1000, marginTop: 6 }}>{brokerPnl >= 0 ? "+" : ""}{money(brokerPnl, asset.currency)}</div>
        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{asset.holding.brokerPnlPct}%</div>
        <div style={{ color: "#64748b", fontSize: 10, marginTop: 8 }}>來源：富邦 App 截圖<br />時間：{snapshotText}</div>
      </div>
      <div style={{ background: "rgba(15,23,42,.9)", border: "1px solid rgba(56,189,248,.25)", borderRadius: 16, padding: 12 }}>
        <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 1000 }}>市場即時估算</div>
        <div style={{ color: livePnl >= 0 ? "#86efac" : "#fca5a5", fontSize: 19, fontWeight: 1000, marginTop: 6 }}>{livePnl >= 0 ? "+" : ""}{money(livePnl, asset.currency)}</div>
        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{asset.liveHolding?.pnlPct ?? 0}%</div>
        <div style={{ color: "#64748b", fontSize: 10, marginTop: 8 }}>來源：公開市場行情<br />依最新價格自動重算</div>
      </div>
    </div>}

    {hasHolding && <div style={{ marginTop: 10, padding: 11, borderRadius: 14, background: "rgba(120,53,15,.16)", border: "1px solid rgba(251,191,36,.22)", color: "#fde68a", fontSize: 11, lineHeight: 1.55, fontWeight: 750 }}>
      兩者可能不同：富邦帳面數字取自券商截圖；市場估算使用公開行情。報價時間、券商帳務價、匯率與費用計算不同，都會造成損益差異。
    </div>}

    {asset.ladderEnabled && <div style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "36px 54px 1fr 1fr", gap: 6, padding: "0 0 7px", color: "#64748b", fontSize: 10, fontWeight: 900 }}>
        <div>層級</div><div>回撤</div><div>價格點位</div><div style={{ textAlign: "right" }}>加碼</div>
      </div>
      {asset.rules.map((rule, index) => {
        const reached = active >= index + 1;
        const pricePoint = targetPrice(asset.high52w, rule);
        return <div key={rule} style={{ display: "grid", gridTemplateColumns: "36px 54px 1fr 1fr", gap: 6, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(148,163,184,.1)", color: reached ? "#86efac" : "#cbd5e1" }}>
          <div style={{ fontSize: 12, fontWeight: 1000 }}>L{index + 1}</div>
          <div style={{ fontSize: 12, fontWeight: 1000 }}>{rule}%</div>
          <div style={{ fontSize: 12, fontWeight: 1000 }}>{money(pricePoint, asset.currency)}</div>
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 900 }}>{money(asset.amounts[index], asset.currency)}</div>
        </div>;
      })}
    </div>}

    <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.5, marginTop: 10, fontWeight: 750 }}>每月 12 日固定 DCA：{money(asset.monthlyAmount, asset.currency)}。價格點位會隨 52 週高點自動更新，分層加碼不取代固定扣款。</div>
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
          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>LIVE PRICE + BROKER SNAPSHOT</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>富邦長期 DCA</h1>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, fontWeight: 800 }}>富邦帳面資料與市場估算分開顯示</div>
        </div>
        <a href="/" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回首頁</a>
      </header>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>公開行情狀態</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 1000 }}>{loading ? "更新中…" : `${liveCount}/3 正常`}</div>
          </div>
          <button onClick={refresh} disabled={loading} style={{ border: "1px solid rgba(56,189,248,.4)", background: "rgba(14,116,144,.16)", color: "#bae6fd", borderRadius: 13, padding: "9px 12px", fontWeight: 1000 }}>{loading ? "讀取中" : "立即更新"}</button>
        </div>
        {data?.checkedAt && <div style={{ color: "#64748b", fontSize: 11, marginTop: 9 }}>公開行情更新：{new Date(data.checkedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</div>}
        {error && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 9 }}>{error}</div>}
      </Card>

      {data?.quotes?.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
      {!data && !error && <Card><div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>正在載入公開市場資料…</div></Card>}

      <Card>
        <div style={{ fontSize: 16, fontWeight: 1000, marginBottom: 8 }}>資料來源說明</div>
        <div style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 13, fontWeight: 800 }}>富邦帳面持倉與損益依你最後提供的 App 截圖；市場價格、52 週高點、回撤、買點及即時估算損益來自公開行情。兩者更新時間和計算方式不同，數字不必完全一致。</div>
      </Card>
    </div>
  </main>;
}
