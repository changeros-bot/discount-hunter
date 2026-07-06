const diagnosticRows = [
  ["代幣價格來源", "只使用 Binance / xStocks / bStocks 已支援標的", "待串接"],
  ["健康篩選", "公司基本面不能明顯破壞", "必填"],
  ["股性 / 波動", "找活潑、有反彈空間的標的", "必填"],
  ["成交量 / 流動性", "原股與代幣都要有量", "必填"],
  ["停止加碼規則", "避免把高波動誤判成可無限攤平", "必填"],
  ["退出規則", "槓桿獵人必須有 Exit，不是長期 DCA", "必填"]
];

const candidates = [
  { symbol: "BTC", name: "比特幣", group: "獨立加密引擎", mode: "有量 / 活潑", priority: "P1", use: "有量、波動大、資料充足；先觀察 Cycle High 回撤與風險上限", status: "主觀察" },
  { symbol: "QQQon / QQQB", name: "Nasdaq-100 代幣", group: "科技大盤", mode: "有量 / 活潑", priority: "P1", use: "科技大盤代理，活潑但比個股穩", status: "主觀察" },
  { symbol: "NVDAon / NVDAB", name: "輝達", group: "AI 基礎建設", mode: "健康 / 高價 / 活潑", priority: "P1", use: "AI 核心龍頭，高股價、高波動、高關注度", status: "主觀察" },
  { symbol: "TSMon", name: "台積電 ADR", group: "AI 基礎建設", mode: "健康 / 有量", priority: "P1", use: "AI 供應鏈核心，健康、有量，波動較可控", status: "主觀察" },
  { symbol: "AVGOon", name: "博通", group: "AI 基礎建設", mode: "健康 / 高價", priority: "P1", use: "AI 網通與 ASIC 核心，高股價、機構參與度高", status: "主觀察" },
  { symbol: "MUon / MUB", name: "美光科技", group: "AI 記憶體", mode: "高價 / 活潑", priority: "P1", use: "AI 記憶體主線，股性活潑，適合波段觀察", status: "主觀察" },
  { symbol: "MRVLon", name: "Marvell", group: "AI 基礎建設", mode: "活潑 / 有量", priority: "P1", use: "AI ASIC / 網通題材，適合波段觀察", status: "主觀察" },
  { symbol: "ARMon", name: "安謀控股", group: "半導體 IP", mode: "高價 / 活潑", priority: "P1", use: "AI / 手機 / 邊緣運算 IP 題材，高關注度", status: "主觀察" },
  { symbol: "AMDon / AMDB", name: "AMD", group: "AI 基礎建設", mode: "活潑 / 高 beta", priority: "P2", use: "股性活潑，但需確認趨勢與執行力", status: "候選" },
  { symbol: "GOOGLon", name: "Alphabet", group: "平台型公司", mode: "健康 / 有量", priority: "P2", use: "健康、有量，但股性相對不夠活潑", status: "候選" },
  { symbol: "METAon / METAB", name: "Meta", group: "平台型公司", mode: "健康 / 有量", priority: "P2", use: "健康、有量，波段性中等", status: "候選" },
  { symbol: "AMZNon", name: "Amazon", group: "平台型公司", mode: "健康 / 有量", priority: "P2", use: "健康、有量，波段性中等", status: "候選" },
  { symbol: "MSFTon / MSFTB", name: "微軟", group: "平台型公司", mode: "健康 / 有量", priority: "P2", use: "健康、有量，但股性偏穩", status: "候選" },
  { symbol: "CRWVon", name: "CoreWeave", group: "AI 算力", mode: "活潑 / 題材強", priority: "P2", use: "AI 算力題材強，但歷史較短", status: "候選" },
  { symbol: "COINon", name: "Coinbase", group: "加密金融", mode: "活潑 / 有量", priority: "P2", use: "有量、活潑，但受加密週期影響", status: "候選" },
  { symbol: "HOODon", name: "Robinhood", group: "金融科技", mode: "活潑 / 有量", priority: "P2", use: "股性活潑，有交易題材，但風險較高", status: "候選" },
  { symbol: "CRCLon / CRCLB", name: "Circle", group: "穩定幣金融", mode: "題材強 / 有量", priority: "P2", use: "穩定幣題材，有量，需觀察估值", status: "候選" },
  { symbol: "PLTRB", name: "Palantir", group: "AI 軟體", mode: "活潑 / 有量", priority: "P2", use: "活潑、有量，但估值敏感", status: "候選" },
  { symbol: "TSLAB / TSLAon", name: "Tesla", group: "高波動科技", mode: "高價 / 活潑", priority: "P2", use: "活潑、高價，但品質與週期需確認", status: "候選" },
  { symbol: "MSTRB", name: "MicroStrategy", group: "BTC 代理", mode: "高 beta", priority: "P2", use: "活潑、有量，但與 BTC 高度綁定", status: "候選" },
  { symbol: "COHRon / CAMTon / MKSIon", name: "光通訊 / 半導體設備組", group: "AI 供應鏈", mode: "活潑", priority: "P2", use: "從截圖看波動活潑，需分別回測與驗證流動性", status: "候選" },
  { symbol: "RKLBon", name: "Rocket Lab", group: "高成長深折扣", mode: "活潑 / 高風險", priority: "P3", use: "活潑但風險高，只保留文件觀察", status: "文件觀察" },
  { symbol: "SPCXon / SPCXB", name: "SpaceX", group: "高成長深折扣", mode: "資料短", priority: "P3", use: "非公開市場代理，歷史資料短，先文件觀察", status: "文件觀察" },
  { symbol: "SNDKon / LITEon / LWLGon", name: "次級光通訊 / 儲存候選", group: "高波動題材", mode: "待確認", priority: "P3", use: "可觀察，但暫不進自動交易", status: "文件觀察" },
  { symbol: "OKLO / IONQ / RGTI / QBTS", name: "核能 / 量子題材", group: "題材股", mode: "高風險", priority: "P3", use: "題材活潑但基本面與流動性需嚴格確認", status: "文件觀察" },
];

const rules = [
  ["進場規則", "只從 Binance 代幣名單內回測，不納入台股 ETF / 美股槓桿 ETF"],
  ["健康條件", "公司基本面不能明顯破壞，Quality 至少不是失敗"],
  ["股價條件", "避免低價垃圾股；優先高價、機構參與度高的標的"],
  ["股性條件", "要活潑，有足夠波動與反彈空間"],
  ["成交量條件", "原股與 Binance 代幣都要有量，價格更新正常"],
  ["停止加碼規則", "跌幅加深、資料異常、波動失控或超過部位上限時停止"],
  ["退出規則", "槓桿獵人必須有 Exit，不允許無限攤平"],
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
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>Leveraged Hunter｜健康・高價・活潑・有量</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 1000 }}>槓桿獵人</h1>
        </div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回四合一</a>
      </header>

      <Card accent="rgba(245,158,11,.32)">
        <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>選股原則</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.65, fontSize: 14, fontWeight: 750 }}>我看過你截圖裡的漲幅榜、AI 發現與 24/7 可交易名單。槓桿 / 波段不是找便宜爛股，而是找健康、股價高、股性活潑、有成交量的標的。</p>
        <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
          <Pill tone="green">健康</Pill>
          <Pill tone="green">股價高</Pill>
          <Pill tone="green">股性活潑</Pill>
          <Pill tone="green">有量</Pill>
          <Pill tone="red">低價低量題材股不進主名單</Pill>
        </div>
      </Card>

      <Card accent="rgba(34,197,94,.28)">
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 1000 }}>Priority 1｜主觀察名單</h2>
        <div style={{ display: "grid", gap: 10 }}>{p1.map((item) => <CandidateCard key={item.symbol} item={item} />)}</div>
      </Card>

      <details open style={{ marginBottom: 12 }}>
        <summary style={{ padding: 14, borderRadius: 18, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)", color: "#fde68a", fontWeight: 1000 }}>Priority 2｜候選觀察（{p2.length}）</summary>
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
          第一階段只使用 Binance 股票代幣 / xStocks / bStocks 名單。<br />
          不納入台股 ETF、不納入傳統美股槓桿 ETF、不納入非代幣化個股。<br />
          槓桿獵人與折價獵人共用資料源，但不共用買入規則。<br />
          標的必須健康、股價高、股性活潑、有量。<br />
          未完成進場、停止加碼、退出、部位上限與 Kill Switch 前，不開啟買點提示。
        </div>
      </Card>
    </div>
  </main>;
}
