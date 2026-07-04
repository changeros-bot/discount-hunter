const rows = [
  ["TAIEX 訊號", "大盤原型訊號", "待串接"],
  ["00631L 實際回撤", "市場真實壓力", "待串接"],
  ["00631L 理論回撤", "與 TAIEX 倍數估算比較", "待串接"],
  ["Dual Drawdown Diagnostic", "實際 vs 理論偏離", "規劃中"]
];

function Card({ children }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)" }}>{children}</section>;
}

function Row({ name, desc, status }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 950 }}>{name}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, marginTop: 4 }}>{desc}</div>
    </div>
    <div style={{ color: "#fde68a", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap", border: "1px solid rgba(245,158,11,.35)", borderRadius: 999, padding: "6px 9px" }}>{status}</div>
  </div>;
}

export default function LeveragedHunterPage() {
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>Leveraged Hunter</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>槓桿獵人</h1>
        </div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回四合一</a>
      </header>

      <Card>
        <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>定位</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 14, fontWeight: 750 }}>這不是 DCA 折價獵人的子功能，而是槓桿 ETF 專用的獨立診斷模組。核心不是單純看跌幅，而是比較 00631L 實際回撤與理論回撤。</p>
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>Dual Drawdown Diagnostic</h2>
        {rows.map(([name, desc, status]) => <Row key={name} name={name} desc={desc} status={status} />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>封板原則</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14, fontWeight: 800 }}>
          00631L 不加入 V17.1 折價獵人 Universe。<br />
          不使用 xStocks 分類器。<br />
          未完成診斷模型前，不開啟買點提示。
        </div>
      </Card>
    </div>
  </main>;
}
