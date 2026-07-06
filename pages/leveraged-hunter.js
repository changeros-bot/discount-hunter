const diagnosticRows = [
  ["TAIEX 訊號", "大盤原型訊號", "待串接"],
  ["00631L 實際回撤", "市場真實壓力", "待串接"],
  ["00631L 理論回撤", "與 TAIEX 倍數估算比較", "待串接"],
  ["Dual Drawdown Diagnostic", "實際 vs 理論偏離", "規劃中"]
];

const candidates = [
  { symbol: "00631L", name: "台灣50正2", group: "台股槓桿核心", leverage: "2x", priority: "P1", use: "台股槓桿獵人核心", status: "先做回測" },
  { symbol: "SSO", name: "S&P 500 兩倍", group: "美股大盤槓桿", leverage: "2x", priority: "P1", use: "溫和槓桿核心候選", status: "先做回測" },
  { symbol: "QLD", name: "Nasdaq-100 兩倍", group: "科技槓桿", leverage: "2x", priority: "P1", use: "科技槓桿核心候選", status: "先做回測" },
  { symbol: "00647L", name: "S&P 500 正2", group: "台股掛牌美股槓桿", leverage: "2x", priority: "P2", use: "美股大盤槓桿替代", status: "回測後決定" },
  { symbol: "UPRO", name: "S&P 500 三倍", group: "美股大盤槓桿", leverage: "3x", priority: "P2", use: "高風險戰術候選", status: "回測後決定" },
  { symbol: "SPXL", name: "S&P 500 三倍", group: "美股大盤槓桿", leverage: "3x", priority: "P2", use: "UPRO 替代比較", status: "回測後決定" },
  { symbol: "TQQQ", name: "Nasdaq-100 三倍", group: "科技槓桿", leverage: "3x", priority: "P2", use: "高風險戰術候選", status: "回測後決定" },
  { symbol: "USD", name: "半導體兩倍", group: "半導體槓桿", leverage: "2x", priority: "P2", use: "半導體槓桿候選", status: "回測後決定" },
  { symbol: "TECL", name: "科技三倍", group: "科技槓桿", leverage: "3x", priority: "P3", use: "文件觀察", status: "不進主畫面" },
  { symbol: "SOXL", name: "半導體三倍", group: "半導體槓桿", leverage: "3x", priority: "P3", use: "極高風險戰術", status: "不進主畫面" },
  { symbol: "FNGU", name: "大型科技 ETN", group: "ETN / 集中槓桿", leverage: "3x", priority: "P3", use: "僅研究", status: "不進主畫面" },
  { symbol: "BULZ", name: "成長股 ETN", group: "ETN / 集中槓桿", leverage: "3x", priority: "P3", use: "僅研究", status: "不進主畫面" },
];

const rules = [
  ["進場規則", "尚未定義，需回測 00631L / SSO / QLD"],
  ["停止加碼規則", "趨勢破壞、波動過大或超過部位上限時停止"],
  ["退出規則", "槓桿獵人必須有 Exit，不允許無限攤平"],
  ["最大部位", "必須小於折價獵人正式持倉上限"],
  ["Kill Switch", "大盤失控、資料錯誤、API 異常時立即停止"]
];

function Card({ children, accent = "rgba(148,163,184,.18)" }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: `1px solid ${accent}`, borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)" }}>{children}</section>;
}

function Pill({ children, tone = "yellow" }) {
  const map = {
    green: ["#bbf7d0", "rgba(34,197,94,.13)", "rgba(34,197,94,.28)"],
    yellow: ["#fde68a", "rgba(245,158,11,.13)", "rgba(245,158,11,.28)"],
    red: ["#fecaca", "rgba(248,113,113,.13)", "rgba(248,113,113,.28)"],
    blue: ["#bae6fd", "rgba(14,165,233,.13)", "rgba(14,165,233,.28)"],
    purple: ["#ddd6fe", "rgba(139,92,246,.13)", "rgba(139,92,246,.28)"],
  };
  const [color, bg, border] = map[tone] || map.yellow;
  return <span style={{ color, background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: "5px 8px", fontSize: 11, fontWeight: 1000 }}>{children}</span>;
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

function CandidateCard({ item }) {
  const tone = item.priority === "P1" ? "green" : item.priority === "P2" ? "yellow" : "red";
  return <div style={{ padding: 12, borderRadius: 16, background: "rgba(15,23,42,.76)", border: "1px solid rgba(148,163,184,.16)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>{item.symbol}</div>
        <div style={{ marginTop: 3, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>{item.name}</div>
      </div>
      <Pill tone={tone}>{item.priority}</Pill>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      <Pill tone="blue">{item.group}</Pill>
      <Pill tone="purple">{item.leverage}</Pill>
      <Pill tone={item.priority === "P3" ? "red" : "yellow"}>{item.status}</Pill>
    </div>
    <div style={{ marginTop: 9, color: "#94a3b8", fontSize: 12, fontWeight: 800, lineHeight: 1.5 }}>{item.use}</div>
  </div>;
}

export default function LeveragedHunterPage() {
  const p1 = candidates.filter((x) => x.priority === "P1");
  const p2 = candidates.filter((x) => x.priority === "P2");
  const p3 = candidates.filter((x) => x.priority === "P3");

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>Leveraged Hunter｜Candidate Registry</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>槓桿獵人</h1>
        </div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回四合一</a>
      </header>

      <Card accent="rgba(245,158,11,.32)">
        <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>定位</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 14, fontWeight: 750 }}>槓桿獵人不是折價獵人的加速版，而是槓桿 ETF 專用的獨立戰術模組。可以和折價獵人共存，但不能混用規則。</p>
        <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
          <Pill tone="yellow">短中期戰術部位</Pill>
          <Pill tone="red">不是長期核心 DCA</Pill>
          <Pill tone="red">不允許無限攤平</Pill>
        </div>
      </Card>

      <Card accent="rgba(34,197,94,.28)">
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>Priority 1｜先做回測與 App 觀察</h2>
        <div style={{ display: "grid", gap: 10 }}>{p1.map((item) => <CandidateCard key={item.symbol} item={item} />)}</div>
      </Card>

      <details open style={{ marginBottom: 12 }}>
        <summary style={{ padding: 14, borderRadius: 18, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)", color: "#fde68a", fontWeight: 1000 }}>Priority 2｜回測後再決定（{p2.length}）</summary>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{p2.map((item) => <CandidateCard key={item.symbol} item={item} />)}</div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ padding: 14, borderRadius: 18, background: "rgba(248,113,113,.10)", border: "1px solid rgba(248,113,113,.24)", color: "#fecaca", fontWeight: 1000 }}>Priority 3｜文件觀察，不進主畫面（{p3.length}）</summary>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{p3.map((item) => <CandidateCard key={item.symbol} item={item} />)}</div>
      </details>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>Dual Drawdown Diagnostic</h2>
        {diagnosticRows.map(([name, desc, status]) => <Row key={name} name={name} desc={desc} status={status} />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>買入前必須完成</h2>
        {rules.map(([name, desc]) => <Row key={name} name={name} desc={desc} status="必填" />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>封板原則</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14, fontWeight: 800 }}>
          00631L 不加入 V17.1 折價獵人 Universe。<br />
          不使用 xStocks 分類器。<br />
          未完成進場、停止加碼、退出、部位上限與 Kill Switch 前，不開啟買點提示。<br />
          槓桿自動交易不得早於折價獵人半自動下單流程成熟。
        </div>
      </Card>
    </div>
  </main>;
}
