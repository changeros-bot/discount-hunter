export default function HomeDashboard() {
  const cards = [
    {
      title: "DCA 折價獵人",
      desc: "BTC + xStocks 折價買點",
      link: "#discount-hunter"
    },
    {
      title: "富邦長期 DCA",
      desc: "0050 / VOO / QQQM",
      link: "#fubon-dca"
    },
    {
      title: "槓桿獵人",
      desc: "Leveraged ETF",
      link: "#leveraged-hunter"
    },
    {
      title: "Josh Financial OS",
      desc: "收入・支出・資產",
      link: "#josh-financial-os"
    }
  ];

  return (
    <section className="home-dashboard">

      <div className="home-hero">
        <h1>Josh Investment OS</h1>
        <p>All Investment Projects in One Place</p>
      </div>

      <div className="home-grid">
        {cards.map(card => (
          <a
            key={card.link}
            href={card.link}
            className="home-card"
          >
            <h2>{card.title}</h2>
            <p>{card.desc}</p>
          </a>
        ))}
      </div>

    </section>
  );
}

