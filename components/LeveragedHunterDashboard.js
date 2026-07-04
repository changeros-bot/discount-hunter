const watchlist = [
  { symbol: "00631L", name: "元大台灣50正2", risk: "High", status: "Watch" },
  { symbol: "QLD", name: "Nasdaq 100 2x", risk: "High", status: "Watch" },
  { symbol: "SOXL", name: "Semiconductor 3x", risk: "Extreme", status: "Research Only" }
];

export default function LeveragedHunterDashboard() {
  return (
    <section className="leveraged-hunter">
      <div className="leveraged-hero">
        <span>TACTICAL ENGINE</span>
        <h2>槓桿獵人</h2>
        <p>只做獨立風控，不和長期 DCA 混用。目標是等待深度折價，不追高。</p>
      </div>

      <div className="leveraged-grid">
        <div><small>模式</small><strong>Watch Only</strong></div>
        <div><small>風險等級</small><strong>High</strong></div>
        <div><small>資金池</small><strong>獨立</strong></div>
        <div><small>狀態</small><strong>規劃中</strong></div>
      </div>

      <div className="leveraged-list">
        {watchlist.map((item) => (
          <article key={item.symbol}>
            <div>
              <b>{item.symbol}</b>
              <p>{item.name}</p>
            </div>
            <div>
              <strong>{item.risk}</strong>
              <span>{item.status}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="leveraged-rule">
        <h3>封鎖規則</h3>
        <p>不得借錢買、不得和核心 DCA 混倉、不得追高、不得無停損、不得在未完成回測前自動交易。</p>
      </div>
    </section>
  );
}
