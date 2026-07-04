const plans = [
  ["0050", "TWD 2,000", "每月 12 日", "台股核心"],
  ["VOO", "USD 30", "每月 12 日", "美股全球核心"],
  ["QQQM", "USD 30", "每月 12 日", "Nasdaq 長期成長"]
];

function Card({ children }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)" }}>{children}</section>;
}

function Row({ symbol, amount, date, note }) {
  return <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
    <div style={{ fontSize: 18, fontWeight: 1000, color: "#bae6fd" }}>{symbol}</div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 950 }}>{amount}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, marginTop: 4 }}>{date}｜{note}</div>
    </div>
  </div>;
}

export default function FubonDcaPage() {
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>Fubon Long-Term DCA</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>富邦長期 DCA</h1>
        </div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回四合一</a>
      </header>

      <Card>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🏦</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>定位</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 14, fontWeight: 750 }}>這是十年以上長期核心資產配置，不做 FOMO、不做短線加碼、不混入折價獵人。它的價值是穩定扣款與不中斷。</p>
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>封板扣款計畫</h2>
        {plans.map(([symbol, amount, date, note]) => <Row key={symbol} symbol={symbol} amount={amount} date={date} note={note} />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>執行原則</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14, fontWeight: 800 }}>
          每月檢查是否扣款成功。<br />
          0050 可未來評估逢低加碼。<br />
          VOO / QQQM 目前只做定期定額，不做零股逢低加碼。
        </div>
      </Card>
    </div>
  </main>;
}
