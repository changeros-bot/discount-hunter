const holdings = [
  { symbol: "0050", name: "元大台灣50", amount: "NT$2,000/月", date: "每月 12 日", status: "Active" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", amount: "US$30/月", date: "每月 12 日", status: "Active" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", amount: "US$30/月", date: "每月 12 日", status: "Active" }
];

export default function FubonDcaDashboard() {
  return (
    <section className="fubon-dca">
      <div className="fubon-hero">
        <span>CORE ENGINE</span>
        <h2>富邦長期台美股 DCA</h2>
        <p>0050 / VOO / QQQM，十年以上不中斷的核心資產累積系統。</p>
      </div>

      <div className="fubon-grid">
        <div><small>每月投入</small><strong>約 NT$3,900+</strong></div>
        <div><small>扣款日</small><strong>每月 12 日</strong></div>
        <div><small>策略</small><strong>Pure DCA</strong></div>
        <div><small>狀態</small><strong>執行中</strong></div>
      </div>

      <div className="fubon-list">
        {holdings.map((item) => (
          <article key={item.symbol}>
            <div>
              <b>{item.symbol}</b>
              <p>{item.name}</p>
            </div>
            <div>
              <strong>{item.amount}</strong>
              <span>{item.date}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="fubon-rule">
        <h3>核心規則</h3>
        <p>不預測、不停扣、不追高殺低。0050 可未來加入逢低加碼；VOO / QQQM 目前僅維持定期定額。</p>
      </div>
    </section>
  );
}
