const diagnosticRows = [
  ["代幣價格來源", "只使用 Binance / xStocks 已支援標的", "待串接"],
  ["高波動診斷", "觀察回撤、波動與反彈條件", "規劃中"],
  ["停止加碼規則", "避免把高波動誤判成可無限攤平", "必填"],
  ["退出規則", "槓桿獵人必須有 Exit，不是長期 DCA", "必填"]
];

const candidates = [
  { symbol: "BTC", token: "BTC", name: "比特幣", group: "獨立加密引擎", mode: "高波動核心", priority: "P1", use: "先觀察 Cycle High 回撤與風險上限", status: "先做回測" },
  { symbol: "QQQon", token: "QQQon", name: "Nasdaq-100 代幣", group: "核心 ETF 代幣", mode: "大盤科技", priority: "P1", use: "科技大盤代理，適合先做槓桿獵人觀察", status: "先做回測" },
  { symbol: "NVDAon", token: "NVDAon", name: "NVIDIA 代幣", group: "AI 基礎建設", mode: "高波動龍頭", priority: "P1", use: "AI 核心龍頭，高波動但品質高", status: "先做回測" },
  { symbol: "TSMon", token: "TSMon", name: "台積電 ADR 代幣", group: "AI 基礎建設", mode: "相對穩定核心", priority: "P1", use: "AI 供應鏈核心，波動低於多數高 beta 標的", status: "先做回測" },
  { symbol: "AVGOon", token: "AVGOon", name: "Broadcom 代幣", group: "AI 基礎建設", mode: "高品質核心", priority: "P1", use: "AI 網通與 ASIC 核心候選", status: "先做回測" },
  { symbol: "AMDon", token: "AMDon", name: "AMD 代幣", group: "AI 基礎建設", mode: "高 beta", priority: "P2", use: "波動較高，等回測後再決定規則", status: "回測後決定" },
  { symbol: "MRVLon", token: "MRVLon", name: "Marvell 代幣", group: "AI 基礎建設", mode: "高 beta", priority: "P2", use: "波動較高，需更嚴格停止加碼規則", status: "回測後決定" },
  { symbol: "GOOGLon", token: "GOOGLon", name: "Alphabet 代幣", group: "平台型公司", mode: "平台核心", priority: "P2", use: "平台型公司候選，波動較低", status: "回測後決定" },
  { symbol: "RKLBon", token: "RKLBon", name: "Rocket Lab 代幣", group: "高成長深折扣", mode: "高風險小部位", priority: "P3", use: "只能小部位觀察，不進自動交易", status: "文件觀察" },
  { symbol: "SPCXon", token: "SPCXon", name: "SpaceX 代幣", group: "高成長深折扣", mode: "非公開市場代理", priority: "P3", use: "資料歷史短，先文件觀察", status: "文件觀察" },
];

const rules = [
  ["進場規則", "只從 Binance 代幣名單內回測，不納入台股 ETF / 美股槓桿 ETF"],
  ["停止加碼規則", "跌幅加深、資料異常、波動失控或超過部位上限時停止"],
  ["退出規則", "槓桿獵人必須有 Exit，不允許無限攤平"],
  ["最大部位", "高波動 / 高成長代幣必須小部位"],
  ["Kill Switch", "資料錯誤、API 異常、價格偏離或交易風險升高時立即停止"]
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
      <Pill tone="purple">{item.mode}</Pill>
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
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>Leveraged Hunter｜Binance Token List Only</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>槓桿獵人</h1>
        </div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回四合一</a>
      </header>

      <Card accent="rgba(245,158,11,.32)">
        <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>定位修正</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 14, fontWeight: 750 }}>槓桿獵人先不納入台股 ETF、美股槓桿 ETF、非代幣化個股。第一階段只從 Binance 股票代幣 / xStocks 名單內挑選高波動候選。</p>
        <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
          <Pill tone="yellow">只做 Binance 代幣名單</Pill>
          <Pill tone="red">不加入 00631L / 00647L</Pill>
          <Pill tone="red">不加入 SSO / QLD / TQQQ / SOXL</Pill>
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
        <summary style={{ padding: 14, borderRadius: 18, background: "rgba(248,113,113,.10)", border: "1px solid rgba(248,113,113,.24)", color: "#fecaca", fontWeight: 1000 }}>Priority 3｜文件觀察，不進自動交易（{p3.length}）</summary>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{p3.map((item) => <CandidateCard key={item.symbol} item={item} />)}</div>
      </details>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>Tokenized Diagnostic</h2>
        {diagnosticRows.map(([name, desc, status]) => <Row key={name} name={name} desc={desc} status={status} />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>買入前必須完成</h2>
        {rules.map(([name, desc]) => <Row key={name} name={name} desc={desc} status="必填" />)}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>封板原則</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14, fontWeight: 800 }}>
          第一階段只使用 Binance 股票代幣 / xStocks 名單。<br />
          不納入台股 ETF、不納入傳統美股槓桿 ETF、不納入非代幣化個股。<br />
          槓桿獵人與折價獵人共用資料源，但不共用買入規則。<br />
          未完成進場、停止加碼、退出、部位上限與 Kill Switch 前，不開啟買點提示。
        </div>
      </Card>
    </div>
  </main>;
}
